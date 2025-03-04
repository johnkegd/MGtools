const hubspot = require('@hubspot/api-client');
import dotenv from 'dotenv';

console. log ('HubSpot module:', hubspot);

export const config = {
  path: '/verify-quote',
};

if (process.env.NETLIFY_DEV === 'true') {
  dotenv.config();
}

function getEnvVariable(key) {
  // Use Netlify.env in production
  if (process.env.NETLIFY === 'true') {
    return Netlify.env.get(key) || '';
  }
  // Use process.env in local development
  return process.env[key] || '';
}
 // Initialize HubSpot client with environment variable
 const hubspotClient = new hubspot.Client({
  accessToken: getEnvVariable('HUBSPOT_API_KEY'),
});

const ASSOCIATIONS = ['contact', 'company'];

const handler = async (req, context) => {
  try {
    // Extract query parameters
    const url = new URL(req.url);
    const quoteId = url.searchParams.get('quoteId');

    // Validate quoteId
    if (!quoteId) {
      console.error("Missing quoteId parameter");
      return new Response(null, {
        status: 301,
        headers: { Location: getEnvVariable('REDIRECT_BASE_URL') },
      });
    }

    // Fetch quote details from HubSpot
    const quoteApiResponse = await hubspotClient.crm.quotes.basicApi.getById(
      quoteId,
      undefined, // properties
      undefined, // propertiesWithHistory
      ASSOCIATIONS, // associations
      false, // archived
      undefined // idProperty
    );

    // Validate quote response
    if (!quoteApiResponse) {
      console.log(`No quote found with id: ${quoteId}`);
      return new Response(null, {
        status: 301,
        headers: { Location: getEnvVariable('REDIRECT_BASE_URL') },
      });
    }

    // Fetch associated contacts and companies
    const { associations } = quoteApiResponse;
    const associatesDetails = [];

    if (associations) {
      const { contacts, companies } = associations;

      // Fetch contact details
      if (contacts?.results) {
        for (const contact of contacts.results) {
          const contactDetails = await hubspotClient.crm.contacts.basicApi.getById(contact.id);
          associatesDetails.push({ type: 'contact', ...contactDetails });
        }
      }

      // Fetch company details
      if (companies?.results) {
        for (const company of companies.results) {
          const companyDetails = await hubspotClient.crm.companies.basicApi.getById(company.id);
          associatesDetails.push({ type: 'company', ...companyDetails });
        }
      }

      // Add merged associations to the response
      quoteApiResponse.associatesDetails = associatesDetails;
    }

    // Log the response for debugging
    console.log(JSON.stringify(quoteApiResponse, null, 2));

    // Prepare redirection URL with quoteApiResponse as a parameter
    const redirectUrl = `${getEnvVariable('REDIRECT_BASE_URL')}?quoteVerified=${encodeURIComponent(
      JSON.stringify(quoteApiResponse)
    )}`;

    // Redirect to the desired URL
    return new Response(null, {
      status: 301,
      headers: { Location: redirectUrl },
    });
  } catch (error) {
    console.error('Error in Netlify function:', error);
    return new Response(null, {
      status: 301,
      headers: { Location: getEnvVariable('REDIRECT_BASE_URL') },
    });
  }
};

export default handler;