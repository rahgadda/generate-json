<script>
    import JsonGenerator from "./JsonGenerator.svelte";
    import Login from "./Login.svelte";
    import { access_token } from '../lib/store.js';

    access_token.subscribe(value => {
        localStorage.setItem("access_token", value)
	});

    const parmas = new URLSearchParams(window.location.search);
    const urlCode = parmas.get("code");
</script>

<h1>{$access_token}</h1>

{#if $access_token || urlCode}
    <JsonGenerator {urlCode} />
{:else}
    <Login />
{/if}