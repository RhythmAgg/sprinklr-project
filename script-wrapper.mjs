import { exec } from 'child_process';
import { promisify } from 'util';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('targetModule', {
    alias: 't',
    type: 'string',
    description: 'The target module to split',
    demandOption: true
  })
  .option('modifyDir', {
    alias: 'm',
    type: 'string',
    description: 'The directory to modify imports',
    default: './',
    demandOption: true
  })
  .help()
  .alias('help', 'h')
  .argv;

const targetModule = argv.targetModule;
const modifyDir = argv.modifyDir;
const mergeRequest = false

const execPromise = promisify(exec);

const firstScript = 'script-split-files.mjs';
const secondScript = 'script-import-resolution.mjs';


const maxBuffer = 1024 * 1024;

async function runScripts() {
    try {
        console.log(`Running first script: ${firstScript}`);
        const { stderr: firstStderr } = await execPromise(`jscodeshift -t ${firstScript} ${targetModule}`, {maxBuffer});
        
        if (firstStderr) {
            console.error(`Error in first script: ${firstStderr}`);
            throw new Error('First script failed.');
        }

        console.log('First script executed successfully. Now running the second script.');

        console.log(`Running second script: ${secondScript}`);
        const { stderr: secondStderr } = await execPromise(`jscodeshift -t ${secondScript} ${modifyDir}`, {maxBuffer});
        
        if (secondStderr) {
            console.error(`Error in second script: ${secondStderr}`);
            throw new Error('Second script failed.');
        }

        console.log('Second script executed successfully.');
        if(mergeRequest) {
          const { stdout: thirdStdout, stderr: thirdStderr } = await execPromise(`node script-gitlab-mr.mjs`);
          if (thirdStderr) {
            console.error(`Error in gitlab-mr script: ${thirdStderr}`);
            throw new Error('gitlab-mr script failed.');
          }else {
            console.log(thirdStdout)
          }
        }
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        process.exit(1);
    }
}

try{
    runScripts();
} catch(err) {
    console.error(`An error occurred: ${err.message}`);
    process.exit(1);
}
