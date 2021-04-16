<script>
    import JsonGenerator from "./JsonGenerator.svelte";
    import Login from "./Login.svelte";

    const parmas = new URLSearchParams(window.location.search);
    const urlCode = parmas.get("code");
</script>

{#if urlCode}
    <JsonGenerator {urlCode} />
{:else}
    <Login />
{/if}