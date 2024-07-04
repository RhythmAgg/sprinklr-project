# Intern Project
The repo contains the main deliverables of the this project. It includes a testing setup, Documentations, the final presentations and the scripts as the deliverables
## Docs
This contains the docs maintained during the project. They are also linked in the presentation and are self explainatory
## test-codemod
Contains the test setup used for testing the scripts. It has many modules and we can test the wrapper script by running
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
## packages
This subdirectory serves as a simulation of the monorepo structure of the main repo. An alias of this package is added to the tsconfig.json and used in typeImport.tsx module in test-codemod. Hence to test the working of the codemods across the mono-repo structure.