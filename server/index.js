const express = require('express');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');

app.use('/static', express.static(path.join(__dirname, '../client/dist/static')));

app.get('/', (req, res) => res.render(path.join(__dirname, '../client/dist/index.ejs')));

app.listen(3000, () => console.log('app is listening on port 3000'));
