import * as fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser';
const PROJECT_DIRECTORY = __dirname
const utilsExports = JSON.parse(fs.readFileSync(path.resolve(PROJECT_DIRECTORY, 'utils-exports.json')))
const utilsReExports = JSON.parse(fs.readFileSync(path.resolve(PROJECT_DIRECTORY, 'utils-re-exports.json')))
const utilsTypes = JSON.parse(fs.readFileSync(path.resolve(PROJECT_DIRECTORY, 'utils-types.json')))
let tsconfig = JSON.parse(fs.readFileSync(path.resolve(PROJECT_DIRECTORY, 'tsconfig.json')))
let tsconfigDir = PROJECT_DIRECTORY

function isValidFileExtension(filePath) {
    return /\.(js|jsx|ts|tsx)$/.test(filePath);
}

const extensions = ['.js', '.ts', '.tsx', '.jsx'];

// removes the extension from the relative file path
function removeSrcExtension(relativePath) {
    const splits = relativePath.split('.')
    const ext = splits[splits.length - 1]
    if(ext == 'js' || ext == 'ts' || ext == 'jsx' || ext == 'tsx') {
        splits.pop()
        return splits.join('.')
    }else {
        return relativePath
    }
}

// relaces the old source with the newly created source
function replaceFileName(filePath, newFileName, importIsFromIndex = false) {
    if(importIsFromIndex) {
        if(!path.basename(filePath).includes('index')) {
            if(filePath.endsWith('/'))
                filePath += 'index'
            else
                filePath += '/index'
        }
    }
    const parts = filePath.split('/');
    parts.pop(); 
    parts.push(newFileName); 
    return parts.join('/');
}

function createDefaultImport(j, importName, src, kind = 'value') {
    return j.importDeclaration(
      [j.importDefaultSpecifier(j.identifier(importName))],
      j.literal(src),
      kind
    );
}
function createNamedImport(j, importName, localName,  src, kind = 'value') {
    return j.importDeclaration(
        [j.importSpecifier(j.identifier(importName), j.identifier(localName))],
        j.literal(src),
        kind
    );
}

function createNamedExport(j, exportName, importName, src, kind = 'value') {
    return j.exportNamedDeclaration(
        null,
        [j.exportSpecifier.from({
            local:j.identifier(importName),
            exported: j.identifier(exportName)
        })],
        src ? j.literal(src) : null,
        kind
      );
}

// Break down wildcard exports into individual items
function modifyWildcardExports(root, j, filePath) {
    let wildcardExportReplacements = []
    let wildcardExportReplacementsNames = []
    root.find(j.ExportAllDeclaration).forEach(pth => {
        const node = pth.node;
        const absSrc = resolveSrcPath(node.source.value, filePath)
        if(node.exportKind === 'type') {
            if(absSrc in utilsTypes) {
                for(const type in utilsTypes[absSrc]) {
                    if(type != 'CREATE_UTILS_OPTION') {
                        if(type != 'reExportTypes') {
                            const newExport = createNamedExport(j, type, type, node.source.value, 'type')
                            newExport.exportKind = 'type'
                            wildcardExportReplacements.push(newExport)
                            wildcardExportReplacementsNames.push(type)
                        }else {
                            for(const reType in utilsTypes[absSrc][type]) {
                                const newExport = createNamedExport(j, reType, reType, node.source.value, 'type')
                                newExport.exportKind = 'type'
                                wildcardExportReplacements.push(newExport)
                                wildcardExportReplacementsNames.push(reType)
                            }
                        }
                    }
                }
            }
            if(wildcardExportReplacements.length > 0) {
                j(pth).replaceWith(wildcardExportReplacements);
            }
        }
        else {
            if(absSrc in utilsExports) {
                for(const exp in utilsExports[absSrc]) {
                    if(exp != 'CREATE_UTILS_OPTION') {
                        if(utilsExports[absSrc][exp].type === 'named') {
                            wildcardExportReplacements.push(createNamedExport(j, exp,exp, node.source.value))
                        }
                        wildcardExportReplacementsNames.push(exp)
                    }
                }
            }
            if(absSrc in utilsReExports) {
                for(const exp in utilsReExports[absSrc]) {
                    wildcardExportReplacements.push(createNamedExport(j, exp, exp, node.source.value))
                    wildcardExportReplacementsNames.push(exp)
                }
            }
            if(wildcardExportReplacements.length > 0) {
                j(pth).replaceWith(wildcardExportReplacements);
            }
        }
        
        wildcardExportReplacements = []
        wildcardExportReplacementsNames = []
    });
}

function modifyWildcardImports(root, j, filePath) {
    let wildcardImportReplacements = []
    let wildcardImportReplacementsNames = []
    root.find(j.ImportDeclaration).forEach(pth => {
        const node = pth.node;
        const specifier = node.specifiers[0]
        const absSrc = resolveSrcPath(node.source.value, filePath)
        const importName = specifier.local.name
        if(specifier.type === 'ImportNamespaceSpecifier' && node.importKind === 'type') {
            const properties = replaceObjectReferences(root, j, importName, false)
            if(absSrc in utilsTypes) {
                for(const type in utilsTypes[absSrc]) {
                    if(type != 'CREATE_UTILS_OPTION') {
                        if(type != 'reExportTypes' && properties.has(type)) {
                            wildcardImportReplacements.push(createNamedImport(j, type, `${type}From${importName}`, node.source.value, 'type'))
                            wildcardImportReplacementsNames.push(type)
                        }else {
                            for(const reType in utilsTypes[absSrc][type]) {
                                if(properties.has(reType)) {
                                    wildcardImportReplacements.push(createNamedImport(j, reType, `${reType}From${importName}`, node.source.value, 'type'))
                                    wildcardImportReplacementsNames.push(reType)
                                }
                            }
                        }
                    }
                }
            }
            if(wildcardImportReplacements.length > 0) {
                replaceObjectReferences(root, j, importName, true)
                j(pth).replaceWith(wildcardImportReplacements);
            }
        }
        else if(specifier.type === 'ImportNamespaceSpecifier') {
            const properties = replaceObjectReferences(root, j, importName, false)
            if(absSrc in utilsExports) {
                for(const exp in utilsExports[absSrc]) {
                    if(exp != 'CREATE_UTILS_OPTION') {
                        if(properties.has(exp) && utilsExports[absSrc][exp].type === 'named') {
                            wildcardImportReplacements.push(createNamedImport(j, exp,`${exp}From${importName}`, node.source.value))
                            wildcardImportReplacementsNames.push(exp)
                        }
                    }
                }
            }
            if(absSrc in utilsReExports) {
                for(const exp in utilsReExports[absSrc]) {
                    if(properties.has(exp)) {
                        wildcardImportReplacements.push(createNamedImport(j, exp, `${exp}From${importName}`, node.source.value))
                        wildcardImportReplacementsNames.push(exp)
                    }
                }
            }
            if(wildcardImportReplacements.length > 0) {
                replaceObjectReferences(root, j, importName, true)
                j(pth).replaceWith(wildcardImportReplacements);
            }
        }
        
        wildcardImportReplacements = []
        wildcardImportReplacementsNames = []
    });

    
}

function splitExportDeclarations(root, j, filePath) {
    function splitExportDeclaration(exportDeclarationNode) {
        const kind = exportDeclarationNode.exportKind;
        const absSrc = resolveSrcPath(exportDeclarationNode.source?.value, filePath);
        
        if ((absSrc in utilsExports) || absSrc in utilsReExports || absSrc in utilsTypes) {
            return exportDeclarationNode.specifiers.map(specifier => {
                const newExport = j.exportNamedDeclaration(null, [specifier], exportDeclarationNode.source, kind);
                return newExport;
            });
        } else {
            return exportDeclarationNode;
        }
    }

    root.find(j.ExportNamedDeclaration).forEach(pth => {
        const node = pth.node;
        if(node.source != null) {
            if (node.specifiers.length > 1) {
                const newNodes = splitExportDeclaration(node);
                j(pth).replaceWith(newNodes);
            }
        }
    });
}


function splitImportDeclarations(root, j, filePath) {
    function splitImportDeclaration(importDeclarationNode) {
        const kind = importDeclarationNode.importKind
        const absSrc = resolveSrcPath(importDeclarationNode.source.value, filePath)
        if((absSrc in utilsExports) || absSrc in utilsReExports || absSrc in utilsTypes) {
            return importDeclarationNode.specifiers.map(specifier => {
                const newImport = j.importDeclaration([specifier], importDeclarationNode.source, kind);
                return newImport
            });
        } else {
            return importDeclarationNode
        }
    }

    root.find(j.ImportDeclaration).forEach(pth => {
        const node = pth.node;
        if (node.specifiers.length > 1) {
            const newNodes = splitImportDeclaration(node);
            j(pth).replaceWith(newNodes);
        }
    });
}

function capitalizeFirstLetter(name) {
    if (!name) return '';

    return name.charAt(0).toUpperCase() + name.slice(1);
}

function replaceObjectReferences(root, j, obj, replace = true) {
    const propertyNames = new Set();

    root.find(j.MemberExpression, {
        object: {
            name: obj, 
        },
    }).forEach((pth) => {
        const memberExpression = pth.node;

        if (memberExpression.property.type === 'Identifier') {
        const prop = memberExpression.property.name;
        const propAlias = `${obj}${capitalizeFirstLetter(prop)}`

        propertyNames.add(prop);
        if(replace)
            j(pth).replaceWith(j.identifier(propAlias));
        }
    });

    return propertyNames;
}

// resolves the declarations which are re-exports of a target module
function evaluateReExport(
    root,
    j,
    pth,
    filePath,
    importPath,
    nodeType = 'import'
) {
    try{
        if(nodeType == 'import') {
            const specifier = pth.node.specifiers[0]
            const localName = specifier.local.name
            const importedName = specifier.imported?specifier.imported.name:localName
            if (importedName in utilsReExports[importPath]) {
                const source = utilsReExports[importPath][importedName].source;
                let relativePath = path.relative(path.dirname(filePath), resolveSrcPath(source, filePath));
                if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
                    relativePath = './' + relativePath;
                }
                const newImport = j.importDeclaration(
                    [j.importSpecifier(j.identifier(utilsReExports[importPath][importedName].imported), j.identifier(localName))],
                    j.literal(removeSrcExtension(relativePath))
                );
                j(pth).replaceWith(newImport);
                return newImport;
            } else {
                return importPath;
            }
        }else {
            const specifier = pth.node.specifiers[0]
            const localName = specifier.local.name
            const exportedName = specifier.exported?specifier.exported.name:localName
            if (localName in utilsReExports[importPath]) {
                const source = utilsReExports[importPath][localName].source;
                let relativePath = path.relative(path.dirname(filePath), resolveSrcPath(source, filePath));
                if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
                    relativePath = './' + relativePath;
                }
                const newExport = createNamedExport(j, exportedName, utilsReExports[importPath][localName].imported, removeSrcExtension(relativePath))
                j(pth).replaceWith(newExport);
                return newExport;
            } else {
                return importPath;
            }
        }
    } catch(err) {
        console.error('Error in evaluating exports', err.message)
    }
}

// resolves a specific direct import from a target module
function modifyImport(
    root,
    j,
    pth,
    importPath,
    filePath
) {
    const specifiers = pth.node.specifiers;

    specifiers.forEach(specifier => {
      const localName = specifier.local.name
      let importedName = specifier.imported?specifier.imported.name:localName
      const utilsDir = utilsExports[importPath].CREATE_UTILS_OPTION
      const fileNameWithExtension = path.basename(importPath);
      const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
      if(importedName == 'default' || specifier.type == 'ImportDefaultSpecifier') {
        importedName = 'default'
      }
      if(utilsExports[importPath][importedName]?.obj) {
        const properties = replaceObjectReferences(root, j, localName)
        const importNodes = Array.from(properties).map((prop) => {
            let relativePath = pth.node.source.value
            const propAlias = `${localName}${capitalizeFirstLetter(prop)}`
            const importIsFromIndex = fileNameWithExtension.includes('index')
            const replacement = utilsDir
                                    ?`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/utils/${prop}`
                                    :`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/${prop}`
                                
            return j.importDeclaration(
                [j.importDefaultSpecifier(j.identifier(propAlias))],
                j.stringLiteral(replaceFileName(relativePath, replacement, importIsFromIndex))
            )
        });
    
        importNodes.forEach((importNode) => {
            j(pth).insertBefore(importNode);
        });
      }
      else{
        let relativePath = pth.node.source.value
        const importIsFromIndex = fileNameWithExtension.includes('index')
        const replacement = utilsDir
                                ?`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/utils/${utilsExports[importPath][importedName].exported}`
                                :`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/${utilsExports[importPath][importedName].exported}`
        const newSrc = replaceFileName(relativePath, replacement, importIsFromIndex)
        let modifiedNode;
        if(importedName == 'default') {
            modifiedNode = createDefaultImport(j, localName, newSrc)
        }
        else {
            modifiedNode = j.importDeclaration(
                [specifier],
                j.stringLiteral(newSrc)
            );
        }

        j(pth).insertAfter(modifiedNode);
      }
    });

    j(pth).remove();
}

// resolves a specific export from a target module
function modifyExport(
    root,
    j,
    pth,
    importPath,
    filePath
) {
    const specifiers = pth.node.specifiers;
    const utilsDir = utilsExports[importPath].CREATE_UTILS_OPTION
    const fileNameWithExtension = path.basename(importPath);
    const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;

    specifiers.forEach(specifier => {
        const localName = specifier.local.name
        const exportedName = specifier.exported?specifier.exported.name:localName
        let relativePath = pth.node.source.value
        const replacement = utilsDir
                                ?`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/utils/${utilsExports[importPath][localName]?.exported}`
                                :`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/${utilsExports[importPath][localName]?.exported}`
        const exportIsFromIndex = fileNameWithExtension.includes('index')
        const newSrc = replaceFileName(relativePath, replacement, exportIsFromIndex)
        const modifiedNode = j.exportNamedDeclaration(
            null,
            [specifier],
            j.stringLiteral(newSrc)
        );

        j(pth).insertAfter(modifiedNode);
    });

    j(pth).remove();
}

function resolveTsConfigPath(src) {
    if (!tsconfig.compilerOptions || !tsconfig.compilerOptions.paths) {
        return null;
    }

    const paths = tsconfig.compilerOptions.paths;

    for (let key in paths) {
        let pattern = key.replace('/*', '/').replace('*', '');
        let regex = new RegExp('^' + pattern + '(.*)$');

        if (regex.test(src)) {
            let alias = paths[key][0].replace('*', '');
            src = src.replace(regex, alias + '$1')
            return path.resolve(tsconfigDir, src.replace(regex, alias + '$1'));
        }
    }

    return null;
}

// returns the absolute path of a source relative to the importing modules
function resolveSrcPath(src, filePath) {
    let alias = false
    if (src[0] == '.' || src[0] == '/') {
        src = path.resolve(path.dirname(filePath), src);
    }else if(src[0] == '@' && src[1] == '/') {
        src = path.join(tsconfigDir, src.slice(1));
    }else {
        let resolvedSrc = resolveTsConfigPath(src);
        if (resolvedSrc) {
            alias = true
            src = resolvedSrc;
        } else {
            return null;
        }
    }
    if(fs.existsSync(src) && fs.statSync(src).isFile()) {
        return src;
    }

    for (const ext of extensions) {
        const exactPath = src + ext;
        if (fs.existsSync(exactPath)) {
            return exactPath;
        }
    }

    const indexFilePath = path.join(src, 'index');
    for (const ext of extensions) {
        const exactPath = indexFilePath + ext;
        if (fs.existsSync(exactPath)) {
            return exactPath;
        }
    }
    return src;
}

// Method to resolve a specific type import/export
function evaluateTypeImport(root, j, pth, filePath, importPath, nodeType = 'import') {
    try{
        let utilsDir = utilsTypes[importPath].CREATE_UTILS_OPTION
        let fileNameWithExtension = path.basename(importPath);
        let fileNameWithoutExtension = path.parse(fileNameWithExtension).name;

        if(nodeType == 'import') {
            const specifier = pth.node.specifiers[0]
            const localName = specifier.local.name
            const importedName = specifier.imported?specifier.imported.name:localName
            let modifiedImportPath = importPath
            if (importedName in utilsTypes[importPath]['reExportTypes']) {
                const source = utilsTypes[importPath]['reExportTypes'][importedName].source;
                let relativePath = path.relative(path.dirname(filePath), resolveSrcPath(source, filePath));
                if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
                    relativePath = './' + relativePath;
                }
                const newImport = j.importDeclaration(
                    [j.importSpecifier(j.identifier(utilsTypes[importPath]['reExportTypes'][importedName].imported), j.identifier(localName))],
                    j.literal(removeSrcExtension(relativePath)),
                    'type'
                );
                j(pth).replaceWith(newImport);
                modifiedImportPath = resolveSrcPath(relativePath, filePath)
            }
            if(modifiedImportPath in utilsTypes && importedName in utilsTypes[modifiedImportPath]) {
                utilsDir = utilsTypes[modifiedImportPath].CREATE_UTILS_OPTION
                fileNameWithExtension = path.basename(modifiedImportPath);
                fileNameWithoutExtension = path.parse(fileNameWithExtension).name;

                let relativePath = pth.node.source.value
                const importIsFromIndex = fileNameWithExtension.includes('index')
                const replacement = utilsDir
                                ?`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/utils/${utilsTypes[modifiedImportPath][importedName].exported}`
                                :`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/${utilsTypes[modifiedImportPath][importedName].exported}`

                const newSrc = replaceFileName(relativePath, replacement, importIsFromIndex)
                const newImport = j.importDeclaration(
                    [specifier],
                    j.stringLiteral(newSrc),
                    'type'
                );

                j(pth).replaceWith(newImport);
            }
        }else {
            const specifier = pth.node.specifiers[0]
            const localName = specifier.local.name
            const exportedName = specifier.exported?specifier.exported.name:localName
            let modifiedImportPath = importPath
            if (localName in utilsTypes[importPath]['reExportTypes']) {
                const source = utilsTypes[importPath]['reExportTypes'][localName].source;
                let relativePath = path.relative(path.dirname(filePath), resolveSrcPath(source, filePath));
                if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
                    relativePath = './' + relativePath;
                }
                const newExport = createNamedExport(j, exportedName, utilsReExports[importPath][localName].imported, removeSrcExtension(relativePath), 'type')
                newExport.exportKind = 'type';
                j(pth).replaceWith(newExport);
                modifiedImportPath = resolveSrcPath(relativePath, filePath)
            } 
            if(modifiedImportPath in utilsTypes && localName in utilsTypes[modifiedImportPath]){
                utilsDir = utilsTypes[modifiedImportPath].CREATE_UTILS_OPTION
                fileNameWithExtension = path.basename(modifiedImportPath);
                fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
                let relativePath = pth.node.source.value
                const importIsFromIndex = fileNameWithExtension.includes('index')
                const replacement = utilsDir
                                ?`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/utils/${utilsTypes[modifiedImportPath][localName]?.exported}`
                                :`${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}/${utilsTypes[modifiedImportPath][localName]?.exported}`

                const newSrc = replaceFileName(relativePath, replacement, importIsFromIndex)
                const newExport = j.exportNamedDeclaration(
                    null,
                    [specifier],
                    j.stringLiteral(newSrc),
                    'type'
                );
                newExport.exportKind = 'type';

                j(pth).replaceWith(newExport);
            }
        }
    } catch(err) {
        console.error('Error in evaluating type import', err.message, filePath, importPath)
    }

}

// Sequentially resolves each import/re-export declaration
function getImportedModules (root, j, filePath, moduleImports) {
    try {
        root.find(j.ImportDeclaration).forEach(pth => {
            if(pth.node.importKind === 'type') {
                const node = pth.node;
                let src = node.source.value;
                let importPath = resolveSrcPath(src, filePath)
                if(importPath != null && (importPath in utilsTypes))
                    evaluateTypeImport(root, j, pth, filePath, importPath)
            }else {
                const node = pth.node;
                let src = node.source.value;
                let importPath = resolveSrcPath(src, filePath)
                if(importPath != null) {
                    moduleImports.add(importPath)
                    if(importPath in utilsReExports) {
                        evaluateReExport(root, j, pth, filePath, importPath)
                        importPath = resolveSrcPath(pth.node.source.value, filePath)
                    }
                    if(importPath in utilsExports) {
                        modifyImport(root, j, pth, importPath, filePath)
                    }
                }
            }
        });

        root.find(j.ExportNamedDeclaration)
        .forEach((pth) => {
            if (pth.node.source) {
                if(pth.node.exportKind === 'type') {
                    const node = pth.node;
                    let src = node.source.value;
                    let importPath = resolveSrcPath(src, filePath)
                    if(importPath != null && (importPath in utilsTypes))
                        evaluateTypeImport(root, j, pth, filePath, importPath, 'export')
                }else {
                    let importPath = resolveSrcPath(pth.node.source.value, filePath);
                    if (importPath !== null) {
                        moduleImports.add(importPath);
                        if(importPath in utilsReExports) {
                            evaluateReExport(root, j, pth, filePath, importPath, 'export')
                            importPath = resolveSrcPath(pth.node.source.value, filePath)
                        }
                        if(importPath in utilsExports) {
                            modifyExport(root, j, pth, importPath, filePath)
                        }
                    }
                }
            }
        });

        const updatedSource = root.toSource();

        fs.writeFileSync(filePath, updatedSource);
        return true
    } catch(error) {
        console.error(`Error parsing file ${filePath}:`, error.message);
        return true
    }
    
}
// babel parser with added typescript support
export const parser = {
    parse(source) {
      return parse(source, {
        sourceType: 'module',
        allowHashBang: true,
        ecmaVersion: Infinity,
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        startLine: 1,
        tokens: true,
        plugins: [
          'typescript',
          'estree',
          'jsx',
          'asyncGenerators',
          'classProperties',
          'doExpressions',
          'exportExtensions',
          'functionBind',
          'functionSent',
          'objectRestSpread',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining',
          ['decorators', {decoratorsBeforeExport: false}],
        ],
      });
    },
  }

function findNearestTsconfig(startPath) {
    let currentDir = startPath;

    while (currentDir !== path.parse(currentDir).root) {
        const tsconfigPath = path.join(currentDir, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath)) {
            return tsconfigPath;
        }
        currentDir = path.dirname(currentDir);
    }

    return null;
}
export default (fileName, api) => {
    if(!(fileName.path.includes('node_modules')) && isValidFileExtension(fileName.path)) {
        const j = api.jscodeshift;
        const root = j(fileName.source);
        const filePath = path.join(PROJECT_DIRECTORY, fileName.path);
        const nearestTsConfigPath = findNearestTsconfig(path.dirname(filePath))
        if(nearestTsConfigPath != null){
            tsconfig = JSON.parse(fs.readFileSync(nearestTsConfigPath))
            tsconfigDir = path.dirname(nearestTsConfigPath)
        }
        let moduleImports = new Set()
        splitImportDeclarations(root, j, filePath)
        splitExportDeclarations(root, j, filePath)
        modifyWildcardImports(root, j, filePath)
        modifyWildcardExports(root, j, filePath)
        getImportedModules(root, j, filePath, moduleImports)
        return root.toSource();
    }
};