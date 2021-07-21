require('dotenv').config();
const _ = require('lodash');
const { gravity } = require('./gravity');
const logger = require('../utils/logger')(module);

const propertyFee = 10;

// This contains specific helper methods for the Metis app
// They are built using gravity
function Metis() {
  function accountEnding(account) {
    const components = account.split('-');
    if (components.length !== 5) {
      return { error: true, message: 'Invalid account', description: 'metis.js : Error with accountEnding function' };
    }
    return components[components.length - 1];
  }

  // Retrieves list of properties.
  async function getChannelProperties(channel) {
    const propertiesResponse = await gravity.getAccountProperties({
      recipient: channel,
    });

    const { properties } = propertiesResponse;

    if (!properties) {
      return {
        error: true,
        message: propertiesResponse.message || 'Error obtaining properties',
        description: 'Metis.js-13 => getChannelProperties()',
        fullError: propertiesResponse,
      };
    }

    return properties;
  }

  function getAliasAccountProperties(aliases) {
    return new Promise((resolve, reject) => {
      const data = [];

      const forEachPromise = new Promise((resolvefp, rejectfp) => {
        aliases.forEach(async (value, index, array) => {
          gravity.getAlias(value)
            .then(userObj => gravity.getAccountProperties({ recipient: userObj.accountRS }))
            .then((userProperties) => {
              const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
              data.push({
                alias: value,
                urlProfile: profilePicture ? profilePicture.value : '',
              });

              if (index === array.length - 1) {
                resolvefp();
              }
            })
            .catch((error) => {
              console.error(error);
              rejectfp(error);
            });
        });
      });

      forEachPromise.then(() => resolve(data))
        .catch(error => reject(error));
    });
  }

  // Gets alias information for a single user within a channel
  async function getMember(params) {
    // We retrieve the member list
    if (!params.password) {
      return {
        error: true,
        message: 'Channel encryption has not been provided',
      };
    }
    const properties = await getChannelProperties(params.channel);

    // If error return response
    if (properties.error) {
      return properties;
    }
    const members = [];
    _.filter(properties, (p) => {
      let property;
      try {
        property = gravity.decrypt(p.property, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (property && property.includes('-a-')) {
        members.push(gravity.decrypt(p.value, params.password));
      }
    });

    // We lodash to look properties containing account of user and
    // the -a- string which are part of alias properties
    const membersMatches = _.filter(properties, (p) => {
      let property;
      try {
        property = gravity.decrypt(p.property, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (property) {
        return property.includes(accountEnding(params.account))
          && property.includes('-a-');
      }
      return false;
    });

    const aliases = [];
    // We use lodash to push value of property (alias) to the aliases list
    _.filter(membersMatches, (p) => {
      let value;
      try {
        value = gravity.decrypt(p.value, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (value && !aliases.includes(value)) {
        aliases.push(value);
      }
    });

    const memberProfilePicture = await getAliasAccountProperties(members);
    return { aliases, members, memberProfilePicture };
  }

  async function addToMemberList(params) {
    if (!params.alias) {
      return { error: true, message: 'No alias provided' };
    }
    // We verify here is user has any existing aliases
    const memberSearch = await getMember(params);
    // We first retrieve the properties from recipient
    if (memberSearch.error) {
      return memberSearch;
    }

    const { aliases } = memberSearch;
    const { members } = memberSearch;
    for (let x = 0; x < aliases.length; x += 1) {
      aliases[x] = aliases[x].toLowerCase();
    }

    for (let x = 0; x < members.length; x += 1) {
      members[x] = members[x].toLowerCase();
    }
    // We verify if the current alias list contains the alias we wish to add to the member list
    const aliasInList = aliases.includes(params.alias.toLowerCase());
    const aliasInMembers = members.includes(params.alias.toLowerCase());

    if (aliasInList || aliasInMembers) {
      return {
        aliases,
        members,
        error: true,
        aliasExists: true,
        message: 'Alias already in member list',
      };
    }

    if (!params.password) {
      return {
        aliases,
        members,
        error: true,
        message: 'Request is missing table encryption',
      };
    }
    const propertyParams = {
      recipient: params.channel,
      feeNQT: propertyFee,
      property: gravity.encrypt(`${accountEnding(params.account)}-a-${aliases.length}`, params.password),
      value: gravity.encrypt(params.alias, params.password),
    };

    const propertyCreation = await gravity.setAcountProperty(propertyParams);

    if (propertyCreation.errorDescription) {
      logger.error(`Property creation failed: ${JSON.stringify(propertyCreation)}`);
      return propertyCreation;
    }

    return {
      success: true,
      message: `${params.alias} has been added to member list of ${params.channel}`,
      fullResponse: propertyCreation,
    };
  }

  return Object.freeze({
    getChannelProperties,
    getMember,
    addToMemberList,
  });
}

module.exports = Metis();
