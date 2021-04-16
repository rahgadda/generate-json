<script>
    import { is_empty } from "svelte/internal";
    import JsonGenerator from "./JsonGenerator.svelte";
    import Login from "./Login.svelte";

    const parmas = new URLSearchParams(window.location.search);
    let urlToken = parmas.get("code");
    console.log(urlToken);
</script>

<h1>Toke is {urlToken} </h1>

{#if {urlToken} }
    <h1>Toke is {urlToken} </h1>
{/if}