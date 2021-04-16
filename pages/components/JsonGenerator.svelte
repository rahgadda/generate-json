<script>
    import { onMount } from "svelte";
    // import { createOAuthAppAuth  } from "@octokit/auth-oauth-app";

    export let urlCode;

    const gitURL =
        "https://raw.githubusercontent.com/rahgadda/generate-json/main/";
    let inputTemplate = "";
    let jsonOutput = "";

    onMount(async function () {
        let response = await fetch(gitURL + "data/sample.hbs");
        inputTemplate = await response.text();
        response = await fetch(gitURL + "response/sample.json");
        jsonOutput = await response.text();
    });

    async function generateToken() {
        // const auth = createOAuthAppAuth({
        //                 clientType: "oauth-app",
        //                 clientId: "32748c79e2f3936ca0cb",
        //                 clientSecret: "c871dbe5c837905a541c03d33fb44858c5973a8b",
        //              });
        // const userAuthenticationFromWebFlow = await auth({
        //                                                 type: "oauth-user",
        //                                                 code: urlCode
        //                                             });
        // console.log("Token is"+ userAuthenticationFromWebFlow.token);
        
    }
</script>

<main class="container">
    <header class="header">
        <h1 class="header-title">JSON Generator</h1>
    </header>
    <div class="button">
        <button on:click={generateToken}>&nbsp;Save&nbsp;</button>
        <button>Reload</button>
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
