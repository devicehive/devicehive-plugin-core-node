const configurator = require(`json-evn-configurator`);


module.exports = (pathToConfigJSON, envPrefix = `PLUGIN`) => {
    try {
        return configurator(pathToConfigJSON, envPrefix);
    } catch (error) {
        console.log(`Error while configuration plugin: ${error}`);
        process.exit();
    }
};