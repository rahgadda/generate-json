<script>
    import JsonGenerator from "./JsonGenerator.svelte";
    import Login from "./Login.svelte";

    const parmas = new URLSearchParams(window.location.search);
    let urlToken = parmas.get("code");
    $: token = urlToken;

    if (token || urlToken) {
        console.log("Loaded with code = " + urlToken);
        console.log("token = "+token);
    }
</script>

{#if { urlToken  }}
    <JsonGenerator />
{:else}
    <Login />
{/if}
