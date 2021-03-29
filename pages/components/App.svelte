<script>
  import Row from "svelte-atoms/Grids/Row.svelte";
  import Cell from "svelte-atoms/Grids/Cell.svelte";
  import Block from "svelte-atoms/Block.svelte";
  import DropZone from "svelte-atoms/DropZone.svelte";

    let fileName = "";

    async function uploadFile(data){
        const response = await fetch("https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs", {
            "method": "PUT",
            "headers": {
                "user-agent": "vscode-restclient",
                "authorization": "token 48b26e9d55e715e0978db99ac231862e83e4701c",
                "accept": "application/vnd.github.v3+json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": {
                "name": "sample.hbs",
                "path": "data/sample.hbs",
                "sha": "b147d4169dd42f6f667623507a7fecc783ae8aa2",
                "content": "ewogICJyYWh1bCI6IFsKICAgIHt7I3JlcGVhdCAyfX0KICAgIHsKICAgICAgImlkIjoge3tAaW5kZXh9fSwKICAgICAgIm5hbWUiOiAie3tmaXJzdE5hbWV9fSB7e2xhc3ROYW1lfX0iLAogICAgICAid29yayI6ICJ7e2NvbXBhbnl9fSIsCiAgICAgICJlbWFpbCI6ICJ7e2VtYWlsfX0iLAogICAgICAiZG9iIjogInt7ZGF0ZSAnMTkwMCcgJzIwMDAnICdZWVlZJ319IiwKICAgICAgImFkZHJlc3MiOiAie3tpbnQgMSAxMDB9fSB7e3N0cmVldH19IiwKICAgICAgImNpdHkiOiAie3tjaXR5fX0iLAogICAgICAib3B0ZWRpbiI6IHt7Ym9vbGVhbn19CiAgICB9CiAgICB7ey9yZXBlYXR9fQogIF0sCiAgImltYWdlcyI6IFsKICAgIHt7I3JlcGVhdCAzfX0KICAgICJpbWd7e0BpbmRleH19LnBuZyIKICAgIHt7L3JlcGVhdH19CiAgXSwKICAiY29vcmRpbmF0ZXMiOiB7CiAgICAieCI6IHt7ZmxvYXQgLTUwIDUwICcwLjAwJ319LAogICAgInkiOiB7e2Zsb2F0IC0yNSAyNSAnMC4wMCd9fQogIH0sCiAgInByaWNlIjogIiR7e2ludCAwIDk5OTk5ICcwLDAnfX0iCn0=",
                "encoding": "base64",
                "message": "Updated From UI"
            }
            })
            .then(response => {
                console.log(response);
            })
            .catch(err => {
                console.error(err);
            });
        
        if (!response.ok) {
            const message = `An error has occured: ${response.status}`;
            throw new Error(message);
        }    
        const updateJson = await response.json();
        return updateJson;
    }

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
            console.log("Fetch Api "+uploadFile(base64String));
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