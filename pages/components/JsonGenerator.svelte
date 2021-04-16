<style>
	.container{
        background: #ff3e00d6;
        padding:10px 30px;
    }
    .header {
        height: 10vh;
        display: flex;
        align-items: center;
        justify-content: center;

    }
    .header-title {
        margin: 0;
        color:#fff;
    }
    .button{
        display: flex;
        align-items:flex-end;
    }
    .html-editor {
        width: 100%;
        display: flex;
        align-items:flex-start;
        justify-content: space-evenly;
    }
    .left-panel, .right-panel {
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

<script>
    import { onMount } from 'svelte';
    const apiURL = "https://raw.githubusercontent.com/rahgadda/generate-json/main/";
	$: inputTemplate= "";
    $: jsonOutput= "";

    onMount(async function() {
        let response = await fetch(apiURL+"data/sample.hbs");
        inputTemplate = await response.text();
        response = await fetch(apiURL+"response/sample.json");
        jsonOutput = await response.text();
    });
</script>

<main class="container">
	<header class="header">
			<h1 class="header-title">JSON Generator</h1>
	</header>
    <button class="button">Genearte Json</button><br/>
	<div class="html-editor">
			<div class="left-panel">
					<textarea bind:value={inputTemplate} class="source"></textarea>
			</div>
			<div class="right-panel">
					<pre class="output">{jsonOutput}</pre>
			</div>
	</div>
</main>