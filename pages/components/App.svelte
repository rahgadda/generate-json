<script>
  import Row from "svelte-atoms/Grids/Row.svelte";
  import Cell from "svelte-atoms/Grids/Cell.svelte";
  import Block from "svelte-atoms/Block.svelte";
  import DropZone from "svelte-atoms/DropZone.svelte";

    let fileName = "";

    async function getSHAToke(){
        const data = await fetch("https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs", {
            "method": "GET",
            "headers": {
                "Authorization": "token <public token>",
                "Accept": "application/vnd.github.v3+json"
            }
            })
            .then(response => response.json())
            .then(data => data.sha)
            .catch(err => {
                console.error(err);
            });

        return data;
    }

    function getUploadPaylod(data,token){
        let payload = {
            name: "sample.hbs",
            path: "data/sample.hbs",
            sha: token,
            content: data,
            encoding: "base64",
            message: "Updated From UI"
        }
        return payload;
    }

    async function uploadFile(data){
        let token= await getSHAToke();
        const finalData = await fetch("https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs", {
            "method": "PUT",
            "headers": {
                "Authorization": "token <public token>",
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": 'application/json'
            },
            "body": JSON.stringify(getUploadPaylod(data,token))
            })
            .then(response => response.json())
            .then(data => data)
            .catch(err => {
                console.error(err);
            });
        
        return await finalData;
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

<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell><Block /></Cell>
</Row>
<Row>
  <Cell xs={5}>
  </Cell>
  <Cell xs={4}>
    <Block>
        <a href="https://raw.githubusercontent.com/rahgadda/generate-json/main/response/sample.json">Downlod Generated Json</a>
    </Block>
  </Cell>
  <Cell xs={3}>
  </Cell>
</Row>