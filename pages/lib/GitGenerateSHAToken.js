import Fetch from "./Fetch.js"

const http = new Fetch;
const gitAPIURL = "https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs";

export default class GitGenerateSHAToken {
    getSHAToken(token){
        //console.log("Access Token in SHA "+token);
        return (async () => await http.getWithToken(gitAPIURL,token) )();
    }
}