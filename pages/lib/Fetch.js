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

    // Make an HTTP POST Request
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
}
