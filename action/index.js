const fs = require('fs');
const dummyjson = require('dummy-json');

const sourceFolderLocation = "../data"
const destinationFolderLocation = "../response"

//Read files in books folder
fs.readdirSync(sourceFolderLocation).forEach(fileName => {

    if (fileName.toString().endsWith(".json")) {
        try {
            console.log("Processing File - " + fileName);
            processJsonFile(fileName);
            console.log("Completed Processing File - " + fileName);
        } catch (err) {
            console.log("Error Processing File - " + fileName);
        }
    }
});

//Processing each file
function processJsonFile(fileName) {
    fs.readFile(sourceFolderLocation + "/" + fileName, 'utf8', function (err, data) {
        if (err) {
            return console.log("Error processing " + fileName + " " + err);
        }
        console.log("Processing JSON file" + fileName + " with data" + data);
    });
}