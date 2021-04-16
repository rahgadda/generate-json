<script>
	import JsonGenerator from './JsonGenerator.svelte';
    import Login from './Login.svelte';
    import { onMount } from 'svelte';

    onMount(() => {
        const parmas= new URLSearchParams(window.location.search)
        console.log("Loaded with code = "+parmas.get("code"));
    });
    
</script>

<Login />