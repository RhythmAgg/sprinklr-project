import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const GITLAB_URL = "https://prod-gitlab-ui.sprinklr.com/";  
const PROJECT_ID = 1830; 
const ACCESS_TOKEN = "glpat-5LcMxzZ6VHrXstH_WFMU"; 
const SOURCE_BRANCH = "codemod-split-modules"; 
const TARGET_BRANCH = "main";
const TITLE = "Split Modules and Import Resolution MR";
const DESCRIPTION = "Codemod for splitting modules and import resolution executed on the repo. Please review the changes and merge!";

async function createBranchAndPush() {
    try {
        console.log("Executing gitlab MR script");
        await deleteBranchIfExists()
        const { stderr: errCheckout } = await execPromise(`git checkout -b ${SOURCE_BRANCH}`);

        const { stderr: errAdd } = await execPromise(`git add .`);

        const { stderr: errCommit } = await execPromise(`git commit -m 'split modules commit'`);

        const { stderr: errPush } = await execPromise(`git push origin ${SOURCE_BRANCH}`);

        console.log("Branch created and pushed successfully!");

        await createMergeRequest();

        const { stderr: errCheckoutTarget } = await execPromise(`git checkout ${TARGET_BRANCH}`);

        const { stderr: errDeleteBranch } = await execPromise(`git branch -D ${SOURCE_BRANCH}`);

        console.log("Local source branch deleted successfully!");

    } catch (error) {
        console.error('Failed to create and push branch:', error);
    }
}

async function deleteBranchIfExists() {
    const url = `${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/repository/branches/${SOURCE_BRANCH}`;

    const headers = {
        "PRIVATE-TOKEN": ACCESS_TOKEN,
    };

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers
        });

        if (response.status === 204) {
            console.log("Remote branch deleted successfully!");
        } else {
            console.error("Failed to delete remote branch");
            console.error("Response code:", response.status);
            const errorData = await response.json();
            console.error("Response body:", errorData);
        }
    } catch (error) {
        console.error('Error deleting remote branch:', error);
    }

}

async function createMergeRequest() {
    const url = `${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests`;

    const headers = {
        "PRIVATE-TOKEN": ACCESS_TOKEN,
        "Content-Type": "application/json"
    };

    const body = {
        "source_branch": SOURCE_BRANCH,
        "target_branch": TARGET_BRANCH,
        "title": TITLE,
        "description": DESCRIPTION
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (response.ok) {
            console.log("Merge Request created successfully!");
        } else {
            console.error("Failed to create Merge Request");
            console.error("Response code:", response.status);
            const errorData = await response.json();
            console.error("Response body:", errorData);
        }

    } catch (error) {
        console.error('Error creating Merge Request:', error);
    }
}

createBranchAndPush();
