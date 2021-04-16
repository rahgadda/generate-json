<script>
	import JsonGenerator from './JsonGenerator.svelte';
    import Login from './Login.svelte';
    import { onMount } from 'svelte';

    let urlToken=null;

    onMount(() => {
        const parmas= new URLSearchParams(window.location.search)
        urlToken = parmas.get("code");
        if(urlToken){
            console.log("Loaded with code = "+urlToken);
        }
    });
    
</script>

{#if urlToken}
    <Login />
{:else}
    <JsonGenerator />
{/if}