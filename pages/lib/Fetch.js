export default class Fetch{
    
    // Make an HTTP GET Request 
    async get(url) {
  
        // Awaiting for fetch response
        const response = await fetch(url);
  
        // Awaiting for response.json()
        const resData = await response.json();
  
        // Returning result data
        return resData;
    }

    // Make an HTTP GET Request 
    async getBase64Data(url) {
  
        // Awaiting for fetch response
        const response = await fetch(url);
  
        // Awaiting for response.json()
        const data = await response.json();
  
        // Getting content
        const base64Data = await data.content;

        //Decoding Data
        const resData = await window.atob(base64Data);

        // Returning result data
        return resData;
    }
  
    // Make an HTTP GET Request with Token as input
    async getWithToken(url,token) {
  
        // Awaiting for fetch response
        const response = await fetch(url,{
            "method": "GET",
            "headers": {
                "Authorization": "token "+token,
                "Accept": "application/vnd.github.v3+json"
            }
        });
  
        // Awaiting for response.json()
        const data = await response.json();

        // Awaiting for data.sha
        const resData = await data.sha;
  
        // Returning result data
        return resData;
    }

    // Make an HTTP POST Request
    async post(url, data) {
  
        // Awaiting for fetch response and 
        // defining method, headers and body  
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
                "Accept":"application/json",
                "origin": "x-requested-with"
            },
            body: JSON.stringify(data)
        });
  
        // Awaiting response.json()
        const resData = await response.json();
  
        // Returning result data
        return resData;
    }

    // Make an HTTP POST Request with No Data
    async postNoData(url) {
  
        // Awaiting for fetch response and 
        // defining method, headers and body  
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
                "Accept":"application/json",
                "origin": "x-requested-with"
            }
        });
  
        // Awaiting response.json()
        const resData = await response.json();
        console.log("Result Data"+JSON.stringify(resData));
        
        // Returning result data
        return resData;
    }

    // Make an HTTP POST Request
    async putWithToken(url,token, data) {
  
        // Awaiting for fetch response and 
        // defining method, headers and body  
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-type': 'application/json',
                "Accept":"application/json",
                "Authorization": "token "+token,
            },
            body: JSON.stringify(data)
        });
  
        // Awaiting response.json()
        const resData = await response.json();
  
        // Returning result data
        return resData;
    }
}
