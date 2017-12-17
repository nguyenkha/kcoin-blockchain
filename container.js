const awilix = require('awilix');
const Lifetime = awilix.Lifetime;

// Export container
exports = module.exports = () => {
  const container = awilix.createContainer();

  // Register itself
  container.registerValue('container', container);

  container.loadModules([
    'services/**/*.js'
  ], {
      formatName: 'camelCase',
      registrationOptions: {
        // Default is singleton
        lifetime: Lifetime.SINGLETON
      }
    });

  console.log('Container loaded modules');

  return container;
};