import {promises as fs} from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import { parse } from '@typescript-eslint/typescript-estree';
import { parse } from '@babel/parser';
const script_filename = fileURLToPath(import.meta.url); 
const PROJECT_DIRECTORY = path.dirname(script_filename);
const src_argv = process.argv[2]
const ENTRY_DIR = path.resolve(PROJECT_DIRECTORY, src_argv)
let moduleImports = new Set()

async function getFiles(dir) {
    const subdirs = await fs.readdir(dir)
    const files = await Promise.all(subdirs.map(async (subdir) => {
      const res = path.resolve(dir, subdir);
      return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

function isValidFileExtension(filePath) {
    return /\.(js|ts|tsx)$/.test(filePath);
}

const extensions = ['.js', '.ts', '.tsx', '.jsx'];

async function getImportedModules (code, filePath) {
    let currentImports = new Set()

    function resolveSrcPath(src) {
        // console.log(src)
        if (src[0] == '.' || src[0] == '/') {
            src = path.resolve(path.dirname(filePath), src);
        }else if(src[0] == '@') {
            if(src[1] == '/')
                src = path.resolve(PROJECT_DIRECTORY, src.slice(2));
            else
                return src = null;
        }else {
            return src = null;
        }
        if(existsSync(src))
            return src;

        for (const ext of extensions) {
            const exactPath = src + ext;
            if (existsSync(exactPath)) {
                return exactPath;
            }
        }
        // Check if it's a directory with an index file
        const indexFilePath = path.join(src, 'index');
        for (const ext of extensions) {
            const exactPath = indexFilePath + ext;
            if (existsSync(exactPath)) {
                return exactPath;
            }
        }
        return src;
    }
    return new Promise((resolve, reject) => {
        try {
            if(filePath.includes('.json')) { // Include JSON files since they always introduce Side Effects when imported
                resolve(true)
            }
            const ast = parse(String(code), {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
                attachComment: true,
            });

            function traverse(node) {
                if (node == null) {
                    return;
                }
                switch(node.type) {
                    case 'File':
                        return traverse(node.program)
                    case 'BlockStatement':
                    case 'Program':
                        // Analyse each node
                        for (const childNode of node.body) {
                            traverse(childNode)
                        }
                        return;
                    case 'ImportDeclaration':
                        let src = node.source.value;
                        let importPath = resolveSrcPath(src)
                        if(importPath != null) {
                            moduleImports.add(importPath)
                            currentImports.add(importPath)
                        }
                        return;
                    case 'ExportAllDeclaration':
                    case 'ExportNamedDeclaration':
                    case 'ExportDefaultDeclaration':
                        if(node.source) {
                            let importPath = resolveSrcPath(node.source.value)
                            if(importPath != null) {
                                moduleImports.add(importPath)
                                currentImports.add(importPath)
                            }
                        }
                        return;
                }
            }
            traverse(ast)
            Array.from(currentImports).forEach(async imp => {
                try{
                    if(imp != null && isValidFileExtension(imp)) {
                        const moduleCode = await fs.readFile(imp);
                        await getImportedModules(moduleCode, imp)
                    }
                }catch(err) {
                    return null
                }
            })
            resolve(true)
        } catch(error) {
            console.error(`Error parsing file ${filePath}:`, error.message);
            resolve(false); 
        }
    })
}

function isPureCallExpression(node) {
    if (!node.leadingComments) {
        return false;
    }
    return node.leadingComments.some(comment => comment.value.trim() === '#__PURE__');
}

async function hasSideEffects(code, filePath) {
    return new Promise((resolve, reject) => {
        try {
            if(filePath.includes('.json')) { // Include JSON files since they always introduce Side Effects when imported
                resolve(true)
                return
            }
            if(!isValidFileExtension(filePath)) {
                resolve(false)
                return;
            }
            const ast = parse(String(code), {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
                attachComment: true,
            });
            
    
            function traverse(node, left = false) {
                if (node == null) {
                    return false;
                }
                switch(node.type) {
                    case 'File':
                        return traverse(node.program)
                    case 'CallExpression':
                        if(isPureCallExpression(node)) // Pure annotated Calls should be ignored
                            return false
                        else if(node.callee.name === 'dynamic') // Dynamic Imports are used for code-splitting in most cases and hence can be considered free
                            return false

                        return true;
                    case 'AssignmentExpression':
                        // Check for global assignments
                        if (node.left.type === 'MemberExpression' && (node.left.object.name === 'window' || node.left.object.name === 'document')) {
                            return true;
                        }

                        return traverse(node.left, left=true) || traverse(node.right, left = false);
                    case 'MemberExpression':
                        // Check if the member expression is assigned to and contains global objects like document, window
                        if(left && (node.object.name === 'window' || node.object.name === 'document')) {
                            return true
                        }else if(left) {
                            return traverse(node.object, left = true)
                        }else {
                            return false
                        }
                    case 'ExpressionStatement':
                        // TODO: Decide if the Call expression is to be marked with /*#__PURE__*/ if pure
                        if(node.expression.type === 'CallExpression' && isPureCallExpression(node))
                        {
                            return false
                        }                        
                        return traverse(node.expression, left);

                    case 'BlockStatement':
                    case 'Program':
                        // Analyse each node
                        for (const childNode of node.body) {
                            if (traverse(childNode, left)) {
                                return true;
                            }
                        }
                        return false
                    case 'VariableDeclaration':
                        // For each declaration if the init is a Call expression or a side effect
                        for (const declaration of node.declarations) {
                            if (traverse(declaration.init, left)) {
                                return true;
                            }
                        }
                        return false
                    case 'IfStatement':
                        // Analyse the test condition, body and the else/else if blocks
                        return traverse(node.test, left) || traverse(node.consequent, left) || traverse(node.alternate, left);
                    
                    case 'LogicalExpression':
                        // Mainly to detect Typeof operator which in most cases indicate presence of polyfills which are popular side effects
                        if (node.operator === '||' && node.left.type === 'UnaryExpression' && node.left.operator === 'typeof') {
                            return true;
                        }
                        if (node.operator === '&&' && node.right.type === 'AssignmentExpression') {
                            return traverse(node.right);
                        }
                        return traverse(node.left) || traverse(node.right);

                    case 'BinaryExpression':
                        // For analysing binrary operations
                        if (node.operator === '===' || node.operator === '!==') {
                            if (node.left.type === 'UnaryExpression' && node.left.operator === 'typeof') {
                                return true;
                            }
                        }
                        return traverse(node.left) || traverse(node.right);

                    case 'UnaryExpression':
                        if (node.operator === 'typeof') {
                            return true;
                        }
                        return traverse(node.argument);

                    case 'WhileStatement':
                    case 'ForStatement':
                        // Checking for loops
                        return traverse(node.test, left) || traverse(node.body, left);

                    case 'ReturnStatement':
                        return traverse(node.argument, left);

                    case 'TryStatement':
                        return traverse(node.block, left) || traverse(node.handler, left) || traverse(node.finalizer, left);

                    case 'CatchClause':
                        return traverse(node.param, left) || traverse(node.body, left);

                    case 'ObjectExpression':
                    case 'ArrayExpression':
                    case 'Literal':
                        return false;
                    case 'ExportNamedDeclaration':
                    case 'ExportDefaultDeclaration':
                        // Analyse Exports if they contains declarations like Variable declarations. Specifiers would have been evaluated before only
                        return traverse(node.declaration);
                    default:
                        return false
                }
            }
            resolve(traverse(ast));
        } catch (error) {
            console.error(`Error parsing file for side effects ${filePath}:`, error.message);
            resolve(false); 
        }
    })
    
}

const files = await getFiles(ENTRY_DIR)
                .then(files => {
                    // return files;
                    return files.filter(file => isValidFileExtension(file))
                })
                .catch(e => console.error(e));

async function getImportSource() {
    return Promise.all(files.map(async (filePath) => {
        try{
            const moduleCode = await fs.readFile(filePath);
            moduleImports.add(filePath)
            await getImportedModules(moduleCode, filePath)
        }catch(err) {
            return null
        }
    }))
}

async function getSideEffect(importModules) {
    return Promise.all(importModules.map(async (filePath) => {
        try{
            const moduleCode = await fs.readFile(filePath);
            const hasEffects = await hasSideEffects(moduleCode, filePath)
            if(hasEffects) {
                return path.relative(PROJECT_DIRECTORY, filePath)
                // return filePath
            } else{
                return null
            }
        }catch(err) {
            return null
        }
    }))
}

const sideEffects = await getImportSource()
    .then(async res => {
        // console.log(moduleImports)
        return await getSideEffect(Array.from(moduleImports).filter(imp => imp != null))
    })
    .then(sideEffects => sideEffects.filter(file => file != null))

console.log(sideEffects, sideEffects.length, moduleImports.size)

async function updatePackage() {
    try {
        const packagePath = path.resolve(PROJECT_DIRECTORY, 'package.json');
        const packageJson = await fs.readFile(packagePath);
        const parsedPackage = JSON.parse(packageJson);

        parsedPackage.sideEffects = sideEffects;

        await fs.writeFile(packagePath, JSON.stringify(parsedPackage, null, 2));
        console.log('Updated package.json with sideEffects array.');
    } catch (error) {
        console.error('Error updating package.json:', error.message);
    } finally {
        process.exit(0);
    }
}

await updatePackage()