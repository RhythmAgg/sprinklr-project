import * as fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser';
let ENTRY_DIR = ''
let newDirectory = ''
let fileExports = {}
let fileReExports = {}
let fileTypes = {}
let propertiesAliases = {}
let moduleImports;
let moduleTypes = {}
let helperCounts = {}
let fileExtension = ''
let currentAbsPath = ''
const PROJECT_DIRECTORY = __dirname
let utilsName = process.argv;
let createUtils = ''

// Finds the non-export type aliases at the module scope
function getModuleTypes(root, j, nonExportTypes) {
  root.find(j.TSTypeAliasDeclaration).forEach(pth => {
    const parent = pth.parent.node;
    if(parent.type === 'Program') {
      nonExportTypes.push(pth.node.id.name)
    }
  });
}

// Implements logic to get the dependencies of an AST node
function getNodeDependencies(j, node, dependencies) {
  // Collect all identifiers within the node
  const identifiers = new Set();
  const localVariables = new Set();
  const functionParameters = new Set();
  const typeAliases = new Set()

  function collectFunctionParameters(param, functionParameters) {
    if (param.type === 'Identifier') {
      functionParameters.add(param.name);
    } else if (param.type === 'ObjectPattern') {
      param.properties.forEach(property => {
        if (property.key && property.key.type === 'Identifier') {
          functionParameters.add(property.key.name);
        }
      });
    } else if(param.type === 'ArrayPattern') {
      param.elements.forEach(ele => {
        if(ele.type === 'Identifier')
          localVariables.add(ele.name);
      })
    }
  }

  // Traverse the node to collect all identifiers
  j(node).find(j.Identifier).forEach(pth => {
    const parentNode = pth.parent.node;
    if (!(parentNode.type === 'MemberExpression' && parentNode.property === pth.node)) {
      identifiers.add(pth.node.name);
    }
  });

  // Collect parameters of function expressions
  j(node).find(j.FunctionExpression).forEach(path => {
    path.node.params.forEach(param => {
      collectFunctionParameters(param, functionParameters);
    });
  });

  // Collect parameters of function declarations
  j(node).find(j.FunctionDeclaration).forEach(path => {
    path.node.params.forEach(param => {
      collectFunctionParameters(param, functionParameters);
    });
  });

  // Collect parameters of arrow functions
  j(node).find(j.ArrowFunctionExpression).forEach(path => {
    path.node.params.forEach(param => {
      collectFunctionParameters(param, functionParameters);
    });
  });

  // Collect local variables declared within the node
  j(node).find(j.VariableDeclarator).forEach(pth => {
    if (pth.node.id.type === 'Identifier') {
      localVariables.add(pth.node.id.name);
    } else if (pth.node.id.type === 'ObjectPattern') {
      pth.node.id.properties.forEach(property => {
        if (property.key && property.key.type === 'Identifier') {
          localVariables.add(property.key.name);
        }
      });
    }else if(pth.node.id.type === 'ArrayPattern') {
      pth.node.id.elements.forEach(ele => {
        if(ele.type === 'Identifier')
          localVariables.add(ele.name);
      })
    }
  });

  // Collect type aliases within the node
  j(node).find(j.TSTypeAliasDeclaration).forEach(pth => {
    typeAliases.add(pth.node.id.name);
  });

  // Filter out parameters, local variables, and type aliases from identifiers
  identifiers.forEach(identifier => {
    if (!functionParameters.has(identifier) && !localVariables.has(identifier) && !typeAliases.has(identifier)) {
      dependencies.add(identifier);
    }
  });

  if(node.type === "Identifier") {
    dependencies.add(node.name);
  }
}

// Clasifies an export as an object or non-object
function checkIfExportsAreObjects(root, j, exports) {
  let exportTypes = {};
  exports.forEach(exp => {
      let found = root.find(j.Identifier, { name: exp });
      exportTypes[exp] = false;
      if (found.length) {
          found.forEach(p => {
              let parent = p.parent.node;
              // console.log(exp, parent)
              if (parent.init && parent.init.type === 'ObjectExpression') {
                  exportTypes[exp] |= true;
              } else if (parent.type === 'VariableDeclarator' && parent.init && parent.init.type === 'ObjectExpression') {
                  exportTypes[exp] |= true;
              } else if (parent.type === 'ExportDefaultDeclaration' && parent.declaration.type === 'ObjectExpression') {
                  exportTypes[exp] |= true;
              } else {
                  exportTypes[exp] |= false;
              }
          });
      } else {
          exportTypes[exp] = false;
      }
  });

  return exportTypes;
}
function addFileExport(filePath, name, exportedName, type, indexFile = false, obj = null) {
  if(!indexFile)
    return
  let absPath = path.resolve(PROJECT_DIRECTORY, filePath);
  fileExports[absPath][name] = {
    exported: exportedName,
    type: type,
    obj: obj
  }
}

// returns the path of the source with added extensions and file name
function resolveSrcPath(src) {
  const extensions = ['.js', '.ts', '.tsx', '.jsx'];
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

// method to update the re-exports of the module
function getReExports(node, filePath, reExports, j){
  if(node.type === 'ExportNamedDeclaration') {
    node.specifiers.forEach(specifier => {
      const absPath = resolveSrcPath(path.join(path.dirname(filePath), node.source.value))
      reExports[specifier.exported.name] = {
        imported: specifier.local.name,
        source: absPath
      }
    })
  } else if(node.type === 'ExportAllDeclaration') {
    const kind = node.exportKind
    let absPath = resolveSrcPath(path.join(path.dirname(filePath), node.source.value))
    const [namedExports, externalReExports, exportedTypes] = getExportNames(absPath, j, false)
    if(kind === 'type') {
      for(const type in exportedTypes) {
        if(type != 'reExportTypes') {
          reExports[type] = {
            imported: type,
            source: absPath
          }
        }
        else{
          for(const reType in exportedTypes['reExportTypes']) {
            reExports[reType] = exportedTypes['reExportTypes'][reType]
          }
        }
      }
    }else {
      namedExports.forEach(exp => {
        reExports[exp] = {
          imported: exp,
          source: absPath
        }
      })
      for(const exp in externalReExports) {
        reExports[exp] = externalReExports[exp]
      }
    }
  }
}

// returns the direct, re-exports and exported types of the module
function getExportNames(filePath, j, indexFile = false) {
  try{
    let exports = []
    let reExports = {}
    let exportedTypes = {}
    exportedTypes['reExportTypes'] = {}
    const Content = fs.readFileSync(filePath, "utf8");
    const root = j(Content);

    root.find(j.ExportNamedDeclaration).forEach((pth) => {
      const kind = pth.node.exportKind
      if (pth.node.source === null) {
        let declaration = pth.node.declaration
        if(declaration)
        {
          if (declaration.id) {
            if(kind === 'type') {
              exportedTypes[declaration.id.name] = {
                exported: declaration.id.name
              }
            }else {
              exports.push(declaration.id.name);
              addFileExport(filePath, declaration.id.name, declaration.id.name, 'named', indexFile)
            }
          }
          else {
            declaration.declarations.forEach((node) => {
              if(kind === 'type') {
                exportedTypes[node.id.name] = {
                  exported: node.id.name
                }
              }else {
                exports.push(node.id.name);
                addFileExport(filePath, node.id.name, node.id.name,  'named', indexFile)
              }
            });
          }
        }else {
          let specifiers = pth.node.specifiers;
          specifiers.forEach(node => {
            if(kind === 'type') {
              exportedTypes[node.local.name] = {
                exported: node.exported.name
              }
            }else {
              exports.push(node.local.name);
              addFileExport(filePath, node.local.name, node.exported.name,  'named', indexFile)
            }
          })
        }
      } else {
        if(kind === 'type') {
          getReExports(pth.node, filePath, exportedTypes['reExportTypes'], j)
        }else {
          getReExports(pth.node, filePath, reExports, j)
        }
      }
    });

    if(indexFile) {
      root.find(j.ExportDefaultDeclaration).forEach((pth) => {
        let declaration = pth.node.declaration
        if (declaration.name){ 
          exports.push(declaration.name);
          addFileExport(filePath, declaration.name, declaration.name,  'default', indexFile)
        }
        else if(declaration.id) {
          exports.push(declaration.id.name);
          addFileExport(filePath, declaration.id.name, declaration.id.name, 'default', indexFile)
        }
        else if(declaration.type === 'ObjectExpression') {
          declaration.properties.forEach(property => {
            exports.push(property.key.name)
            addFileExport(filePath, property.key.name, property.key.name, 'default', indexFile)
          })
        }
      });
    }

    root.find(j.ExportAllDeclaration).forEach((pth) => {
      const kind = pth.node.exportKind
      if(kind === 'type') {
        getReExports(pth.node, filePath, exportedTypes['reExportTypes'], j)
      }else
        getReExports(pth.node, filePath, reExports, j)
    })

    return [exports, reExports, exportedTypes]
  } catch(err) {
    console.log(`Error reading exports of ${filePath}`, err.message)
    return [[], {}, {}]
  }
}

// Checks if a AST node for an indentifier is required in the file or not
function isRequiredInFile(node, identifierName) {
  if(node == null)
      return false;
  let requiredinFile = true;
  if(node.type == 'TSTypeAliasDeclaration' && node.id?.name != identifierName)
    requiredinFile = false
  else if(node.type == 'Identifier' && node.name != identifierName)
    requiredinFile = false
  else if(node.type == 'MemberExpression') {
    requiredinFile = isRequiredInFile(node.object, identifierName)
  }
  else if(node.type == "AssignmentExpression") {
    requiredinFile = isRequiredInFile(node.left, identifierName)
  }
  else if (node.type == "ExpressionStatement") {
    requiredinFile = isRequiredInFile(node.expression.left, identifierName)
  }
  else if(node.type === "FunctionDeclaration" && node.id.name != identifierName) {
    requiredinFile = false;
  }
  else if(node.type == "VariableDeclaration") {
    requiredinFile = node.declarations.some(declaration => declaration.id && declaration.id.name === identifierName);
  }
  else if(node.type == "ExportNamedDeclaration" || node.type == "ExportDefaultDeclaration") {
    if(node.declaration)
      requiredinFile = isRequiredInFile(node.declaration, identifierName)
    else
      requiredinFile = isRequiredInFile(node.specifiers[0].local, identifierName)
  }
  else if (node.declaration && node.declaration.declarations) {
      requiredinFile = node.declaration.declarations.some(declaration => declaration.id && declaration.id.name === identifierName);
  }

  return requiredinFile

}

function createDefaultImport(j, importName, src) {
  return j.importDeclaration(
    [j.importDefaultSpecifier(j.identifier(importName))],
    j.literal(src)
  );
}
function createNamedImport(j, importName, localName,  src, kind = 'value') {
  return j.importDeclaration(
      [j.importSpecifier(j.identifier(importName), j.identifier(localName))],
      j.literal(src),
      kind
  );
}

// Implements the noval graph algorithm for updating dependency graph with a single exports as source
function getHelperCount(root, j, vis, nodeName, exported, nodeDependencies) {
  let localDependencies = new Set()
  root.find(j.Identifier, { name: nodeName }).forEach((pth) => {
    while (pth.parent.node.type != "Program") {
      pth = pth.parent;
    }
    
    if (!vis.has(pth.node) && isRequiredInFile(pth.node, nodeName)) {
      getNodeDependencies(j, pth.node, localDependencies)
      vis.add(pth.node);
    }
  });
  localDependencies.delete(nodeName)
  Array.from(localDependencies).forEach(dependency => {
    if(!(dependency in moduleImports) && !exported.includes(dependency) && 
      !(dependency in propertiesAliases) && 
      !(dependency in moduleTypes && moduleTypes[dependency].export)
    ) {
      if(!nodeDependencies.has(dependency)) {
        if(dependency in helperCounts)
          helperCounts[dependency].count += 1;
        else {
          helperCounts[dependency] = {
            count: 1,
            parents: new Set()
          }
        }
        getHelperCount(root, j, vis, dependency, exported, nodeDependencies)
      }
      if(dependency in helperCounts)
        helperCounts[dependency].parents.add(nodeName);
      else {
        helperCounts[dependency] = {
          count: 0,
          parents: new Set(nodeName)
        }
      }
    }
    nodeDependencies.add(dependency)
  })
  
}

// Update code of helper modules
function addToHelperModule(root, j, nodeName, vis, helperName, exported, helpers) {
  if(nodeName != helperName && (nodeName in moduleTypes) && moduleTypes[nodeName].export) {
    const importName = moduleTypes[nodeName].exportName
    const newImport = createNamedImport(j, importName, nodeName, `./${nodeName}`, 'type')

    if (!vis.has(newImport)) {
      helpers[helperName].push(newImport);
      vis.add(newImport);
    }
  }
  else if(nodeName in propertiesAliases && exported.includes(propertiesAliases[nodeName])) {
    const newImport = createDefaultImport(j, nodeName, `./${propertiesAliases[nodeName]}`)

    if (!vis.has(newImport)) {
      helpers[helperName].push(newImport);
      vis.add(newImport);
    }
  }
  else if(nodeName != helperName && exported.includes(nodeName) )
  {
    let newImport;
    if((nodeName in fileExports[currentAbsPath]) && fileExports[currentAbsPath][nodeName].type == 'named') {
      newImport = createNamedImport(j, nodeName, nodeName, `./${nodeName}`)
    }
    else
      newImport = createDefaultImport(j, nodeName, `./${nodeName}`)

    if (!vis.has(newImport)) {
      helpers[helperName].push(newImport);
      vis.add(newImport);
    }
    return;
  }else if(nodeName != helperName && (nodeName in helpers)) {
    const newImport = createDefaultImport(j, nodeName, `./${nodeName}`)

    if (!vis.has(newImport)) {
      helpers[helperName].push(newImport);
      vis.add(newImport);
    }
  }else if(nodeName != helperName && !(nodeName in moduleTypes)) {
    let helpVis = new Set()
    helpers[nodeName] = []
    addToHelperModule(root, j, nodeName, helpVis, nodeName, exported, helpers)
    if(nodeName in helpers) {
      if(!(nodeName in helperCounts)) 
        console.log(nodeName)
      if((helperCounts[nodeName].count > 1 && helperCounts[nodeName].parents.size > 1)) {
        const newImport = createDefaultImport(j, nodeName, `./${nodeName}`)

        if (!vis.has(newImport)) {
          helpers[helperName].push(newImport);
          vis.add(newImport);
        }
      }else {
        helpers[nodeName].pop()
        helpers[nodeName].forEach(node => {
          if (!vis.has(node)) {
            helpers[helperName].push(node);
            vis.add(node);
          }
        })
        delete helpers[nodeName]
      }
    }
  }
  else {
    let nodeDependencies = new Set()
    let collectPrimaryCode = []
    root.find(j.Identifier, { name: nodeName }).forEach((pth) => {
      while (pth.parent.node.type != "Program") {
        pth = pth.parent;
      }
      
      if (!vis.has(pth.node) && isRequiredInFile(pth.node, nodeName)) {
        collectPrimaryCode.push(pth.node)
        getNodeDependencies(j, pth.node, nodeDependencies)
        vis.add(pth.node);
      }
    });
    nodeDependencies.delete(nodeName)

    Array.from(nodeDependencies).forEach(dependency => { 
      if(dependency in moduleImports) {
        if(!vis.has(moduleImports[dependency])) {
          helpers[helperName].push(moduleImports[dependency]);
          vis.add(moduleImports[dependency])
        }
      }
      else if(dependency != nodeName) {
        addToHelperModule(root, j, dependency, vis, helperName, exported, helpers)
      }
    })
    helpers[helperName] = [...helpers[helperName], ...collectPrimaryCode]
    if(helpers[helperName].length > 0)
      helpers[helperName].push(j.exportDefaultDeclaration(j.identifier(helperName)))
    else
      delete helpers[helperName]
  }

}

// Update code of export modules
function addToExportModule(root, j, nodeName, code, vis, mainExport, exported, helpers, typeExport = false) {
  if(nodeName != mainExport && (nodeName in moduleTypes) && moduleTypes[nodeName].export) {
    let newImport;
    const importName = moduleTypes[nodeName].exportName
    if(typeExport == true) 
      newImport = createNamedImport(j, importName, nodeName, `./${nodeName}`, 'type')
    else
      newImport = createNamedImport(j, importName, nodeName, `./${nodeName}`, 'type')

    if (!vis.has(newImport)) {
      code[mainExport].push(newImport);
      vis.add(newImport);
    }
  }
  else if(nodeName in propertiesAliases && exported.includes(propertiesAliases[nodeName])) {
    let newImport;
    if(typeExport == true) 
      newImport = createDefaultImport(j, nodeName, `./${propertiesAliases[nodeName]}`)
    else
      newImport = createDefaultImport(j, nodeName, `./${propertiesAliases[nodeName]}`)

    if (!vis.has(newImport)) {
      code[mainExport].push(newImport);
      vis.add(newImport);
    }
  }
  else if(nodeName != mainExport && exported.includes(nodeName) )
  {
    let newImport;
    if((nodeName in fileExports[currentAbsPath]) && fileExports[currentAbsPath][nodeName].type == 'named') {
      if(typeExport == true)
        newImport = createNamedImport(j, fileExports[currentAbsPath][nodeName].exported, nodeName, `./${nodeName}`)
      else
        newImport = createNamedImport(j, fileExports[currentAbsPath][nodeName].exported, nodeName, `./${nodeName}`)
    }
    else{
      if(typeExport == true)
        newImport = createDefaultImport(j, nodeName, `./${nodeName}`)
      else
        newImport = createDefaultImport(j, nodeName, `./${nodeName}`)
    }

    if (!vis.has(newImport)) {
      code[mainExport].push(newImport);
      vis.add(newImport);
    }
    return;
  }else if(nodeName in helpers) {
    const newImport = createDefaultImport(j, nodeName, `./${nodeName}`)

    if (!vis.has(newImport)) {
      code[mainExport].push(newImport);
      vis.add(newImport);
    }
  } else if(nodeName != mainExport && !(nodeName in moduleTypes)) {
    let helpVis = new Set()
    helpers[nodeName] = []
    addToHelperModule(root, j, nodeName, helpVis, nodeName, exported, helpers)
    if(nodeName in helpers) {
      if((helperCounts[nodeName].count > 1 && helperCounts[nodeName].parents.size > 1)) {
        const newImport = createDefaultImport(j, nodeName, `./${nodeName}`)

        if (!vis.has(newImport)) {
          code[mainExport].push(newImport);
          vis.add(newImport);
        }
      }else {
        helpers[nodeName].pop()
        helpers[nodeName].forEach(node => {
          if (!vis.has(node)) {
            code[mainExport].push(node);
            vis.add(node);
          }
        })
        delete helpers[nodeName]
      }
    }
  }
  else {
    let nodeDependencies = new Set()
    let collectPrimaryCode = []
    root.find(j.Identifier, { name: nodeName }).forEach((pth) => {
      while (pth.parent.node.type != "Program") {
        pth = pth.parent;
      }
      
      if (!vis.has(pth.node) && isRequiredInFile(pth.node, nodeName)) {
        collectPrimaryCode.push(pth.node)
        getNodeDependencies(j, pth.node, nodeDependencies)
        vis.add(pth.node);
      }
    });
    nodeDependencies.delete(nodeName)
    Array.from(nodeDependencies).forEach(dependency => {
      if(dependency in moduleImports) {
        if(!vis.has(moduleImports[dependency])) {
          code[mainExport].push(moduleImports[dependency]);
          vis.add(moduleImports[dependency])
        }
      }
      else if(dependency != nodeName)
        addToExportModule(root, j, dependency, code, vis, mainExport, exported, helpers, typeExport)
    })
    code[mainExport] = [...code[mainExport], ...collectPrimaryCode]
  }
}

function sortByImports(code, exp) {
  return code[exp].sort((a, b) => {
    if (a.type === 'ImportDeclaration' && b.type !== 'ImportDeclaration') {
      return -1; 
    }
    if (a.type !== 'ImportDeclaration' && b.type === 'ImportDeclaration') {
      return 1; 
    }
    return 0; 
  });
}

function sortByExports(code, exp) {
  return code[exp].sort((a, b) => {
    if (a.type === 'ExportNamedDeclaration' || a.type === 'ExportDefaultDeclaration') {
      if (!(b.type === 'ExportNamedDeclaration' || b.type === 'ExportDefaultDeclaration')) {
        return 1; 
      }
    } else {
      if (b.type === 'ExportNamedDeclaration' || b.type === 'ExportDefaultDeclaration') {
        return -1; 
      }
    }
    return 0; 
  });
}

// Creates the export modules
function createIndependentModules(
  j,
  exp,
  code,
  typeExport = false) {
    let program = j.program(code[exp]);
    const Content = j(program).toSource();
    const subDir = createUtils?'utils':''
    const localpath = createUtils?path.join(newDirectory, `./utils/${exp}${fileExtension}`):path.join(newDirectory, `./${exp}${fileExtension}`)
    if (!fs.existsSync(path.join(newDirectory, `./${subDir}`))) {
      fs.mkdirSync(path.join(newDirectory, `./${subDir}`));
    }
    if (fs.existsSync(localpath)) {
      fs.appendFileSync(localpath, Content, "utf8");
    } else {
      fs.writeFileSync(localpath, Content, "utf8");
    }
}

// Creates the helper modules
function createHelperModules(
  j,
  helpers
) {
  Object.keys(helpers).forEach(helperName => {
    helpers[helperName] = sortByImports(helpers, helperName)
    let program = j.program(helpers[helperName]);
    const Content = j(program).toSource();
    const subDir = createUtils?'utils':''
    const localpath = createUtils?path.join(newDirectory, `./utils/${helperName}${fileExtension}`):path.join(newDirectory, `./${helperName}${fileExtension}`)
    if (!fs.existsSync(path.join(newDirectory, `./${subDir}`))) {
      fs.mkdirSync(path.join(newDirectory, `./${subDir}`));
    }
    if (fs.existsSync(localpath)) {
      fs.appendFileSync(localpath, Content, "utf8");
    } else {
      fs.writeFileSync(localpath, Content, "utf8");
    }
  })
}

// Split the non-object exports into separate modules
function splitNonObjectCode(
  root,
  j,
  exports,
  exported,
  helpers
) {
  let code = {};
  exports.forEach((exp) => {
    code[exp] = [];
    let vis = new Set();
    addToExportModule(root, j, exp, code, vis, exp, exported, helpers)
    code[exp] = sortByImports(code, exp)
    code[exp] = sortByExports(code, exp)
    createIndependentModules(j, exp, code)
  });
}

// spli the type exporst into separate modules
function splitTypesCode(
  root,
  j,
  typeExports,
  exported,
  helpers
) {
  let code = {};
  typeExports.forEach((exp) => {
    code[exp] = [];
    let vis = new Set();
    addToExportModule(root, j, exp, code, vis, exp, exported, helpers, true)
    code[exp] = sortByImports(code, exp)
    code[exp] = sortByExports(code, exp)
    createIndependentModules(j, exp, code, true)
  });
}

// Maps properties of an object export with its value node
function getObjectExportProps(
  root,
  j,
  exp,
  props
) {
  let found = root.find(j.Identifier, { name: exp });
  if (found.length) {
      found.forEach(p => {
          let parent = p.parent.node;
          if (parent.init && parent.init.type === 'ObjectExpression') {
              parent.init.properties.forEach(prop => {
                props[prop.key.name] = prop.value
              })
          } else if (parent.type === 'VariableDeclarator' && parent.init && parent.init.type === 'ObjectExpression') {
            parent.init.properties.forEach(prop => {
              props[prop.key.name] = prop.value
            })
          } else if (parent.type === 'ExportDefaultDeclaration' && parent.declaration.type === 'ObjectExpression') {
            parent.init.properties.forEach(prop => {
              props[prop.key.name] = prop.value
            })
          }
      })
    }
}

function createConstNode(j, key, value) {
  return j.variableDeclaration('const', [
    j.variableDeclarator(
      j.identifier(key),
      value
    )
  ]);
}

function checkKeyEqualsValue(k, key, value) {
  if(value.type === "Identifier" && value.name == key)
    return true;
  else
    return false;
}

// split object exports into separate modules for each of its properties
function splitObjectExports(
  root,
  j,
  exports,
  exported,
  helpers
) {
  let code = {};
  exports.forEach((exp) => {
    let props = {}
    getObjectExportProps(root, j, exp, props)
    exported.push(...Object.keys(props))
    Object.keys(props).forEach(prop => {
      let nodeDependencies = new Set()
      try{
        getNodeDependencies(j, props[prop], nodeDependencies)
      } catch(err) {
        console.log('Error: ',exp, prop, props)
      }
      code[prop] = [];
      let vis = new Set();
      Array.from(nodeDependencies).forEach(dependency => {
          if(dependency in moduleImports)
            code[prop].push(moduleImports[dependency])
          else
            addToExportModule(root, j, dependency, code, vis, prop, exported, helpers)
      })
      if(!checkKeyEqualsValue(j, prop, props[prop]))
      {
        code[prop].push(createConstNode(j, prop, props[prop]))
      }
      code[prop].push(j.exportDefaultDeclaration(j.identifier(prop)))
      code[prop] = sortByImports(code, prop)
      createIndependentModules(j, prop, code)
    })
  });

}

// splits multiple together variable declarations into separate declarations
function replaceVariableDeclarations(
  root,
  j
) {
  function splitVariableDeclarations(variableDeclarationNode) {
    return variableDeclarationNode.declarations.map(declaration => {
      return j.variableDeclaration(variableDeclarationNode.kind, [declaration]);
    });
  }

  root.find(j.VariableDeclaration).forEach(pth => {
    const node = pth.node;
    if (node.declarations.length > 1) {
      const newNodes = splitVariableDeclarations(node);
      j(pth).replaceWith(newNodes);
    }
  });
}

// splits multiple together import declarations into separate declarations
function splitImportDeclarations(root, j) {
  moduleImports = {}
  function splitImportDeclaration(importDeclarationNode) {
    return importDeclarationNode.specifiers.map(specifier => {
      const importKind = importDeclarationNode.importKind
      const newImport = j.importDeclaration([specifier], importDeclarationNode.source, importKind);
      moduleImports[specifier.local.name] = newImport
      return newImport
    });
  }

  root.find(j.ImportDeclaration).forEach(pth => {
    const node = pth.node;
    if (node.specifiers.length > 1) {
      const newNodes = splitImportDeclaration(node);
      j(pth).replaceWith(newNodes);
    }else {
      moduleImports[node.specifiers[0].local.name] = node
    }
  });
}

// Create property Aliases for avoiding naming conflicts
function replaceObjectMemberExpressions(
  root,
  j,
  objectExports,
) {
  root.find(j.MemberExpression)
    .forEach(pth => {
      const { object, property } = pth.node;
      if ((object.type === 'Identifier' && objectExports.includes(object.name)) || object.type === 'ThisExpression') {
        const replacement = `${property.name}From${object.type === 'ThisExpression'?'this':object.name}`
        propertiesAliases[replacement] = property.name 
        j(pth).replaceWith(j.identifier(replacement));
      }
    });
}

// Modifies the re-export source primarily for newly created index file
function modifyReExportSources(
  root,
  j
) {
  root.find(j.ExportNamedDeclaration)
    .forEach(pth => {
      const exportSource = pth.node.source?.value;
      if(exportSource != null) {
        let newExportSource = exportSource;
        const exportKind = pth.node.exportKind
        
        if (exportSource[0] == '.' && exportSource[1] == '/') {
          newExportSource = exportSource.replace('./', '../');
        } else if (exportSource[0] == '.' && exportSource[1] == '.') {
          newExportSource = '../' + exportSource;
        }
        const newExport = j.exportNamedDeclaration(
          null,
          pth.node.specifiers,
          j.literal(newExportSource),
          exportKind
        )
        newExport.exportKind = exportKind
        j(pth).replaceWith(newExport);
      }
    });

  root.find(j.ExportAllDeclaration)
    .forEach(pth => {
      const exportSource = pth.node.source?.value;
      if(exportSource != null) {
        let newExportSource = exportSource;
        const exportKind = pth.node.exportKind
        
        if (exportSource[0] == '.' && exportSource[1] == '/') {
          newExportSource = exportSource.replace('./', '../');
        } else if (exportSource[0] == '.' && exportSource[1] == '.') {
          newExportSource = '../' + exportSource;
        }

        pth.node.source.value = newExportSource
        
        j(pth).replaceWith(pth.node)
      }
    });
}

// Modifies the import sources relative to the new path
function modifyImportSources(
  root,
  j
) {

  root.find(j.ImportDeclaration)
    .forEach(pth => {
      const importSource = pth.node.source.value;
      
      let newImportSource = importSource;
      const importKind = pth.node.importKind
      
      if (importSource[0] == '.' && importSource[1] == '/') {
        newImportSource = importSource.replace('./', '../');
      } else if (importSource[0] == '.' && importSource[1] == '.') {
        newImportSource = '../' + importSource;
      }
      
      j(pth).replaceWith(
        j.importDeclaration(
          pth.node.specifiers,
          j.literal(newImportSource),
          importKind
        )
      );
    });
}

// split multiple export specifier into separate export declarations
function separateExportSpecifiers(root, j) {
  root.find(j.ExportNamedDeclaration)
    .forEach(pth => {
      const node = pth.node;
      
      if (node.specifiers.length > 1) {
        const newExportDeclarations = node.specifiers.map(specifier => 
          j.exportNamedDeclaration(
            null,
            [specifier],
            node.source,
            pth.node.exportKind
          )
        );
        
        j(pth).replaceWith(newExportDeclarations);
      }
    });
}

// Collects the exports and builds the overall dependency graph 
function getHelperGraph( root, j, objectExports, nonObjectExports, typeExports ) {
  let exported = [...nonObjectExports]
  let exportedProps = {}
  objectExports.forEach(exp => {
    let found = root.find(j.Identifier, { name: exp });
    if (found.length) {
        found.forEach(p => {
            let parent = p.parent.node;
            if (parent.init && parent.init.type === 'ObjectExpression') {
                parent.init.properties.forEach(prop => {
                  exported.push(prop.key.name)
                  exportedProps[prop.key.name] = prop.value
                })
            } else if (parent.type === 'VariableDeclarator' && parent.init && parent.init.type === 'ObjectExpression') {
              parent.init.properties.forEach(prop => {
                exported.push(prop.key.name)
                exportedProps[prop.key.name] = prop.value
              })
            } else if (parent.type === 'ExportDefaultDeclaration' && parent.declaration.type === 'ObjectExpression') {
              parent.init.properties.forEach(prop => {
                exported.push(prop.key.name)
                exportedProps[prop.key.name] = prop.value
              })
            }
        })
    }
  })
  exported = [...exported, ...typeExports]
  nonObjectExports.forEach(exp => {
    let vis = new Set()
    let nodeDependencies = new Set()
    getHelperCount(root, j, vis, exp, exported, nodeDependencies)
  })
  typeExports.forEach(exp => {
    let vis = new Set()
    let nodeDependencies = new Set()
    getHelperCount(root, j, vis, exp, exported, nodeDependencies)
  })
  Object.keys(exportedProps).forEach(exp => {
    let vis = new Set()
    let nodeDependencies = new Set()
    let localDependencies = new Set()
    getNodeDependencies(j, exportedProps[exp], localDependencies)
    Array.from(localDependencies).forEach(dependency => {
      if(!(dependency in moduleImports) && !(dependency != exp && exported.includes(dependency)) && 
        !(dependency in propertiesAliases) && 
        !(dependency in moduleTypes && moduleTypes[dependency].export)
      ) {
        if(!nodeDependencies.has(dependency)) {
          if(dependency in helperCounts)
            helperCounts[dependency].count += 1;
          else {
            helperCounts[dependency] = {
              count: 1,
              parents: new Set()
            }
          }
          getHelperCount(root, j, vis, dependency, exported, nodeDependencies)
        }
        if(dependency in helperCounts)
          helperCounts[dependency].parents.add(exp);
        else {
          helperCounts[dependency] = {
            count: 0,
            parents: new Set(exp)
          }
        }
      }
      nodeDependencies.add(dependency)
  })
})
}

function processExports(filePath, j) {
    const Content = fs.readFileSync(filePath, "utf8");
    const root = j(Content);
    const absPath = path.resolve(PROJECT_DIRECTORY, filePath)
    currentAbsPath = absPath
    fileExports[absPath] = {}
    fileReExports[absPath] = {}
    fileTypes[absPath] = {}
    moduleTypes = {}
    let nonExportTypes = []
    getModuleTypes(root, j, nonExportTypes)
    const [exports, reExports, exportedTypes] = getExportNames(filePath, j, true)
    nonExportTypes.forEach(type => {
      if(!(type in exportedTypes)) {
        moduleTypes[type] = {
          export: false,
          exportName: null
        }
      }
    })
    for(const type in exportedTypes) {
      if(type != 'reExportTypes') {
        moduleTypes[type] = {
          export: true,
          exportName: exportedTypes[type].exported
        }
      }
    }
    for(const exp in reExports) {
      fileReExports[absPath][exp] = reExports[exp]
    }
    const exportTypes = checkIfExportsAreObjects(root, j, exports)
    const nonObjectExports = exports.filter(exp => exportTypes[exp] == false)
    let exported = [...nonObjectExports]
    const objectExports = exports.filter(exp => exportTypes[exp] == true)
    nonObjectExports.forEach(exp => {
      fileExports[absPath][exp].obj = false
    })
    objectExports.forEach(exp => {
      fileExports[absPath][exp].obj = true
    })
    const typeExports = Object.keys(moduleTypes).filter(exp => moduleTypes[exp].export)
    modifyImportSources(root, j)
    modifyReExportSources(root, j)
    const indexPath = path.join(newDirectory, `index${fileExtension}`)
    fs.writeFileSync(indexPath, root.toSource(), "utf8")
    if(createUtils)
      modifyImportSources(root, j)

    separateExportSpecifiers(root, j)
    splitImportDeclarations(root, j)
    replaceVariableDeclarations(root, j) 
    propertiesAliases = {}
    replaceObjectMemberExpressions(root, j, objectExports)
    let helpers = {}
    getHelperGraph(root, j, objectExports, nonObjectExports, typeExports)
    splitObjectExports(root, j, objectExports, exported, helpers);
    splitNonObjectCode(root, j, nonObjectExports, exported, helpers);
    splitTypesCode(root, j, typeExports, exported, helpers)
    createHelperModules(j, helpers)
    const utilsExport = path.resolve(PROJECT_DIRECTORY, 'utils-exports.json')
    const utilsReExport = path.resolve(PROJECT_DIRECTORY, 'utils-re-exports.json')
    const utilsTypes = path.resolve(PROJECT_DIRECTORY, 'utils-types.json')
    let modifiedFileExports = {}
    modifiedFileExports[absPath] = {
      CREATE_UTILS_OPTION: createUtils
    }
    for(const exp in fileExports[absPath]) {
      const exportedName = fileExports[absPath][exp].exported
      if(fileExports[absPath][exp].type == 'default') {
        modifiedFileExports[absPath]['default'] = {...fileExports[absPath][exp], exported: exp}
      }else
        modifiedFileExports[absPath][exportedName] = {...fileExports[absPath][exp], exported: exp}
    }
    if(fs.existsSync(utilsExport)) {
      const currentUtilsExport = JSON.parse(fs.readFileSync(utilsExport))
      modifiedFileExports = {...currentUtilsExport, ...modifiedFileExports}
    }
    fs.writeFileSync(utilsExport, JSON.stringify(modifiedFileExports))

    if(fs.existsSync(utilsReExport)) {
      const currentUtilsReExport = JSON.parse(fs.readFileSync(utilsReExport))
      fileReExports = {...currentUtilsReExport, ...fileReExports}
    }
    fs.writeFileSync(utilsReExport, JSON.stringify(fileReExports))

    fileTypes[absPath] = {
      CREATE_UTILS_OPTION: createUtils
    }
    for(const exp in exportedTypes) {
      if(exp != 'reExportTypes') {
        const exportedName = exportedTypes[exp].exported
        fileTypes[absPath][exportedName] = {...exportedTypes[exp], exported: exp}
      }else
        fileTypes[absPath][exp] = exportedTypes[exp]
    }
    if(fs.existsSync(utilsTypes)) {
      const currentUtilsTypes = JSON.parse(fs.readFileSync(utilsTypes))
      fileTypes = {...currentUtilsTypes, ...fileTypes}
    }
    fs.writeFileSync(utilsTypes, JSON.stringify(fileTypes))
}

// export const parser = "babel";
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
export default (fileName, api, options) => {
    const j = api.jscodeshift;
    const root = j(fileName.source); 

    utilsName = options.targetName
    createUtils = options.createUtils

    const fileNameWithExtension = path.basename(fileName.path);

    const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
    
    if(path.basename(fileName.path).includes(utilsName)) {
      ENTRY_DIR = path.dirname(fileName.path)
      newDirectory = path.join(ENTRY_DIR, `${fileNameWithoutExtension != 'index'?fileNameWithoutExtension:'utils'}`)
      if (fs.existsSync(newDirectory)) {
        const stats = fs.statSync(newDirectory);
        if (!stats.isDirectory()) {
          fs.mkdirSync(newDirectory)
        }
      } else {
          fs.mkdirSync(newDirectory)
      }
      const itemPath = path.join(PROJECT_DIRECTORY, fileName.path);
      fileExtension = path.extname(itemPath)

      processExports(itemPath, j);
    }
    return root.toSource();
  };