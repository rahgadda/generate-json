import Fetch from "./Fetch.js"

const http = new Fetch;
const gitAPIURL = "https://github.com/login/oauth/access_token?client_id=32748c79e2f3936ca0cb&client_secret=c871dbe5c837905a541c03d33fb44858c5973a8b&code=";

export default class GitGenerateToken{
    constructor(code ){
        console.log(gitAPIURL);
        this.token = http.postNoData(gitAPIURL+code);
    }

    getToken(){
        return this.token;
    }
}