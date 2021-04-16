<script>
    import { is_empty } from "svelte/internal";
    import JsonGenerator from "./JsonGenerator.svelte";
    import Login from "./Login.svelte";

    const parmas = new URLSearchParams(window.location.search);
    const urlToken = parmas.get("code");
    console.log(urlToken);
</script>

{#if urlToken}
    <JsonGenerator />
{:else}
    <Login />
{/if}