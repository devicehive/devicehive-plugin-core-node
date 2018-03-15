const configurator = require(`json-evn-configurator`);


module.exports = (pathToConfigJSON, envPrefix = `PLUGIN`, ignoreCase) => {
    try {
        return configurator(pathToConfigJSON, envPrefix, ignoreCase);
    } catch (error) {
        console.log(`Error while configuration plugin: ${error}`);
        process.exit();
    }
};