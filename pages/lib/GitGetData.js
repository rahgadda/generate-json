import Fetch from "./Fetch.js"

const http = new Fetch;
const gitAPIURL = "https://api.github.com/repos/rahgadda/generate-json/contents/";

export default class GitGetData{
    getBase64Data(code){
        return (async () => await http.getBase64Data(gitAPIURL+code) )();
    }
}