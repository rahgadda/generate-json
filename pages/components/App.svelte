<script>
  import Row from "svelte-atoms/Grids/Row.svelte";
  import Cell from "svelte-atoms/Grids/Cell.svelte";
  import Block from "svelte-atoms/Block.svelte";
  import DropZone from "svelte-atoms/DropZone.svelte";

    let fileName = "";
    const onChange =  e =>  {
        const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        fileName = file ? file.name : "";
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64String = reader.result
                .replace("data:", "")
                .replace(/^.+,/, "");
            console.log(base64String);
        };
        
    };
</script>

<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell xs={3}>
  </Cell>
  <Cell xs={6}>
    <Block>
        <DropZone fileTitle={fileName} dropOnPage on:drop={onChange} on:change={onChange} />
    </Block>
  </Cell>
  <Cell xs={3}>
  </Cell>
</Row>