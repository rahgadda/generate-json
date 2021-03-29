const fs = require('fs');
const dummyjson = require('dummy-json');

const sourceFolderLocation = "../data"
const destinationFolderLocation = "../response"

//Read files in books folder
fs.readdirSync(sourceFolderLocation).forEach(fileName => {
    if (fileName.toString().endsWith(".json")) {
        console.log("Processing File - " + fileName);
        processTxtFile(fileName);
        console.log("Completed Processing File - " + fileName);
    }
});

//Processing each file
function processTxtFile(fileName) {
    fs.readFile(sourceFolderLocation+"/"+fileName, 'utf8', function (err,data) {
        if (err) {
            return console.log("Error processing " + fileName + " " + err);
        }
        console.log("Processing JSON file"+ fileName + " with data" +data);
    });
}