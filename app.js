const express = require('express');
const axios = require('axios');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const cors = require('cors');
app.use(cors());

const app = express();

app.use(cors()); // Allow cross-origin requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Handle JSON payloads
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate', async (req, res) => {
  const { bot_id, api_key } = req.body;

  try {
    // Fetch the JSON data from the API
    const url = `https://cloud.yellow.ai/api/ai/bot/export?bot=${bot_id}`;
    const headers = { 'x-api-key': api_key };
    const response = await axios.get(url, { headers });

    if (response.status !== 200 || !response.data.data) {
      throw new Error('Failed to fetch data from API');
    }

    const data = response.data;

    // Extract Data
    const journeys = data.data.data.journeys;
    const functions = data.data.data.allFunctions;
    const botTablesStructure = data.data.data.botTablesStructure;
    const apis = data.data.data.allApis;

    // Process Data
    const functionDetails = processFunctions(functions);
    const journeyDetails = processJourneys(journeys);
    const dbDetails = processBotTablesStructure(botTablesStructure);
    const apiDetails = processApis(apis);

    // Create CSVs
    await createCsv(functionDetails, ['Sl_No', 'Id', 'Function Name', 'Description', 'Code'], 'functions_doc.csv');
    await createCsv(journeyDetails, ['Sl_No', 'Id', 'Journey Name', 'Description'], 'journeys_doc.csv');
    await createCsv(dbDetails, ['Sl_No', 'Id', 'Table Name', 'Schema Name'], 'database_doc.csv');
    await createCsv(apiDetails, ['Sl_No', 'Name', 'Type', 'URL', 'Headers', 'Params', 'JsonBody'], 'apis_doc.csv');

    // Create a zip file containing all CSVs
    const output = fs.createWriteStream(path.join(__dirname, 'public', 'bot_data.zip'));
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', function () {
      res.download(path.join(__dirname, 'public', 'bot_data.zip'));
    });

    archive.on('error', function (err) {
      throw err;
    });

    archive.pipe(output);

    archive.file('functions_doc.csv', { name: 'functions_doc.csv' });
    archive.file('journeys_doc.csv', { name: 'journeys_doc.csv' });
    archive.file('database_doc.csv', { name: 'database_doc.csv' });
    archive.file('apis_doc.csv', { name: 'apis_doc.csv' });

    await archive.finalize();

  } catch (error) {
    console.error(error.message);
    res.status(400).json({ error: error.message || 'Internal Server Error' });
  }
});

const processFunctions = (functions) => {
  return functions.map((func, index) => ({
    Sl_No: index + 1,
    Id: func._id || '',
    'Function Name': func.name || '',
    Description: func.email || '',
    Code: func.code || ''
  }));
};

const processJourneys = (journeys) => {
  return journeys.map((journey, index) => ({
    Sl_No: index + 1,
    Id: journey._id || '',
    'Journey Name': journey.name || '',
    Description: journey.description?.value || ''
  }));
};

const processBotTablesStructure = (botTablesStructure) => {
  return botTablesStructure.map((table, index) => {
    const schemaNames = Object.values(table.mapping || {}).map(field => field.fieldName).join(', ');
    return {
      Sl_No: index + 1,
      Id: table.id || '',
      'Table Name': table.tableName || '',
      'Schema Name': schemaNames || ''
    };
  });
};

const processApis = (apis) => {
  return apis.map((api, index) => {
    const headersStr = (api.headers || []).map(header => `${header.key}: ${header.value}`).join('; ');
    const paramsStr = (api.params || []).map(param => `${param.key}: ${param.value || ''}`).join('; ');
    return {
      Sl_No: index + 1,
      Name: api.name || '',
      Type: api.type || '',
      URL: api.url || '',
      Headers: headersStr || '',
      Params: paramsStr || '',
      JsonBody: api.jsonBody || ''
    };
  });
};

const createCsv = async (data, header, fileName) => {
  const csvWriter = createObjectCsvWriter({
    path: fileName,
    header: header.map(title => ({ id: title, title }))
  });
  await csvWriter.writeRecords(data);
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
