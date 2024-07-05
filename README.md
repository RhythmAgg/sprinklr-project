# Intern Project
The repo contains the main deliverables of the this project. It includes a testing setup, Documentations, the final presentations and the scripts as the deliverables
## Docs
This contains the docs maintained during the project. They are also linked in the presentation and are self explainatory
## test-codemod
First the node_modules needs to be installed. run `npm i` that will install all the required dependencies.\
The directory contains the test setup used for testing the scripts. It has many modules and we can test the wrapper script by running
```
node script-wrapper.mjs --targetModule test-codemod/<Name of module>
```
To run the split modules individually, run
```
jscodeshift -t script-split-files.mjs test-codemod/<Name of module>
```
To run the import resolution script ( it will run on the entire repo)
```
jscodeshift -t script-import-resolution.mjs
```
Using the setup we can test the sideEffects field too. run the command 
```
node script-sideEffects.mjs
```
Each module in the directory has a specual purpose:
- `importingModule`: It is a sample module from the main repo. It imports the main utility **targetModule** and uses it. It is used to check the core logic of import resolution codemod
- `targetModule`: This is another huge utility file example from the main repo. It is used to test the split modules codemod
- `mixedExports`: It is a module having both direct and re-exports. It tests the ability to eliminate barrel exports by the scripts
- `multipleExports`: It is a small utility file used primarily for testing wildcard imports
- `typeImports`: This module checks the wildcard and type imports
- `types`: This example is picked from spaceweb project. It exports many different type declarations and is used to check type export splitting by the scripts
## packages
This subdirectory serves as a simulation of the monorepo structure of the main repo. An alias of this package is added to the tsconfig.json and used in typeImport.tsx module in test-codemod. Hence to test the working of the codemods across the mono-repo structure.