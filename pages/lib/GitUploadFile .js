import Fetch from "./Fetch.js"

const http = new Fetch;
const gitAPIURL = "https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs";

export default class GitUploadFile {
    uploadTemplate(token,data){
        return (async () => await http.postWithToken(gitAPIURL,token,data) )();
    }
}