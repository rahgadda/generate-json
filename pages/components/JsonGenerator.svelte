<script>
    import { onMount } from "svelte";
    import  GitGenerateToken from "../lib/GitGenerateToken.js"
    import  GitGenerateSHAToken from "../lib/GitGenerateSHAToken.js"
    import  GitUploadFile from "../lib/GitUploadFile.js"

    export let urlCode;
    const gitURL =
        "https://raw.githubusercontent.com/rahgadda/generate-json/main/";
    let inputTemplate = "";
    let jsonOutput = "";
    let accessToken="";
    let shaToken="";

    onMount(async function () {
        let response = await fetch(gitURL + "data/sample.hbs",{
            "method": "GET",
            "headers": {
                'pragma': 'no-cache',
                'cache-control': 'no-cache'
            }
        });
        inputTemplate = await response.text();
        response = await fetch(gitURL + "response/sample.json",{
            "method": "GET",
            "headers": {
                'pragma': 'no-cache',
                'cache-control': 'no-cache'
            }
        });
        jsonOutput = await response.text();
    });

    async function saveFile() {
        console.log("Saving File ");
        let response = await new GitGenerateToken().getToken(urlCode);
        accessToken = await response.access_token;
        response = await new GitGenerateSHAToken().getSHAToken(accessToken);
        shaToken = await response;
        let data = {
            name: "sample.hbs",
            path: "data/sample.hbs",
            sha: shaToken,
            content: btoa(inputTemplate),
            encoding: "base64",
            message: "Updated From UI"
        }
        response = await new GitUploadFile().uploadTemplate(accessToken,data);
    }

    async function refreshJson() {
        console.log("Refersh JSON "+urlCode)
        let response = await fetch(gitURL + "data/sample.hbs",{
            "method": "GET",
            "headers": {
                'pragma': 'no-cache',
                'cache-control': 'no-cache'
            }
        });
        inputTemplate = await response.text();
        response = await fetch(gitURL + "response/sample.json",{
            "method": "GET",
            "headers": {
                'pragma': 'no-cache',
                'cache-control': 'no-cache'
            }
        });
        jsonOutput = await response.text();
    }
</script>

<!-- <h1>Token is {accessToken}</h1> -->
<!-- <h1>Token is {shaToken}</h1>  -->
<main class="container">
    <header class="header">
        <h1 class="header-title">JSON Generator</h1>
    </header>
    <div class="button">
        <button on:click={saveFile}>&nbsp;Save&nbsp;</button>
        <button on:click={refreshJson}>Reload</button>
    </div>
    <div class="html-editor">
        <div class="left-panel">
            <textarea bind:value={inputTemplate} class="source" />
        </div>
        <div class="right-panel">
            <pre class="output">{jsonOutput}</pre>
        </div>
    </div>
</main>

<style>
    .container {
        background: #ff3e00d6;
        padding: 10px 30px;
    }
    .header {
        height: 10vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .header-title {
        margin: 0;
        color: #fff;
    }
    .button {
        display: flex;
        align-items: flex-end;
    }
    .html-editor {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-evenly;
    }
    .left-panel,
    .right-panel {
        width: 50%;
        border: solid 1px black;
        height: 85vh;
        background: #ffffff;
    }
    .right-panel {
        overflow: auto;
    }
    .source {
        border: none;
        width: 100%;
        height: 100%;
        background: #001628;
        color: #83ba52;
    }
    .source:focus {
        outline: none;
    }
    .output {
        width: 100%;
        padding: 0 2em;
    }
</style>
