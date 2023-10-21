# Miro-based Visual Modelling Tool Support for PEPML

## Installation Guidelines

Follow Miro guide to [create a development team](https://developers.miro.com/docs/create-a-developer-team) and [register a development app](https://developers.miro.com/docs/manually-create-an-app#step-1-create-your-app-in-miro). Use ```http://localhost:3000/``` as the app's URL. The access token assigned to the app is not relevant, since this app only uses the Miro's WebSDK. However, the access will be relevant if you plan an extension that uses the Miro's REST API.

```
git clone https://github.com/dwolters/pepml.git
cd pepml
npm install
```

The app uses several parsers based on [Peggy.js](https://peggyjs.org/) and uses [Handlebars](https://handlebarsjs.com/) to gerade TGGs.
Since the app is intended to run fully in a browser, we cannot access any local files.
Therefore, we convert all parsers and templates to modules using the following command:

```
npm run convert
```

**Run command above everytime you change any file ending in ```.pegjs``` or ```.hjs```**

For the app to run locally, you need to install a [Neo4j database](https://neo4j.com/) with [APOC support](https://neo4j.com/docs/apoc/current/). The easiest way to do this is using [Docker](https://docker.com):

```
docker run -d \
  -p 7474:7474 -p 7687:7687 \
  -e apoc.export.file.enabled=true \
  -e apoc.import.file.enabled=true \
  -e apoc.import.file.use_neo4j_config=true \
  -e NEO4J_PLUGINS='[\"apoc\"]' \
  --name neo -e NEO4J_AUTH=neo4j/MYPASSWORD \
  neo4j:5.9.0
```

Be sure to replace 'MYPASSWORD' in this command with a secure password.
This command stores the data of your database in the docker container.
For development purposes where the data is disposable, this may be fine.
To make sure that the data stays available even if your container gets corrupted, add ```--volume=$HOME/neo4j/data:/data```.
Depending on your OS, the folder before the colon may needs to be adapted.
Further information about the Neo4j docker image can be found on [Docker Hub](https://hub.docker.com/_/neo4j).

Edit the file [`config.ts`](src/config.ts) and adapt the credentials for your Neo4j installation as needed.
If you use the the above Docker command, you only need to adapt the password.

Finally, start the app by calling:

```
npm start
```

The app uses [Vite](https://vitejs.dev/) and any changes are applied immedately to the app.

## Getting Started
Open a development Miro board and the app should appear in the left toolbar.
Click the icon and select the model tab.
Load the default TGGs by going to 'Advanced Features' and click 'Load Default TGGs'.
Now you should be able to select a TGG in the 'Model Type' selection field.
You can edit the TGG by clicking on 'Edit' right next to the selection field.
For now, the TGGs are stored in the browsers local storage.
Meaning all changes to the TGGs are stored within the specific browser you are using.

To test the model extraction, you can use the example Miro boards in the folder [boards](boards/).
You can upload the board via the menu item 'Upload from backup' in Miro's dashbard.

To test the extraction, select a target model.
If no target model is offered in the selection field, click 'New' to add a new one.
Afterwards, click 'Validate and Extract' and the board content is transformed into a model. 

You can inspect the extracted model in Neo4j's web interface, which should be available under: [http://localhost:7474/browser/](http://localhost:7474/browser/)

The follwing queries are handy for model inspection:

### Showing the Miro Models
```
MATCH (n) 
WHERE (n.enamespace STARTS WITH 'Miro_') 
AND NOT n:Miro__Board 
RETURN n
```

This will show you all extracted Miro models.
To show the one specific to your board use `Miro_BOARDID` as the value for `enamespace`.
You can find your board id in the boards URL.

### Showing a PEPML Model
```
MATCH (n) 
WHERE (n.enamespace = 'YOUR_MODEL_NAME') 
AND NOT n:PEPML__EducationProgramme
RETURN n
```

Replace the placeholder with the model name provided in the target model selection field.

## Adapting the app for other visual languages
The current version of the app is tailored to PEPML.
However, most parts of the app are generic an can be reused for building tool support for other modelling languages.
Below you find a list of PEPML-specific files and instructions on extending the app.

### PEPML-specific files
* [portfolio tab](src/components/tabs/portfolio-tab.vue): Tab to import PEPML elements from a database
* [entity tab](src/components/tabs/entity.vue): Tab to add PEPML-specific visual elements


### Adding new TGGs and specifying preprocessors
Look at the folder [tggs](tggs/) to see how you can register TGGs and specify preprocessors.
When you add new files to the folder, run `npm run convert` afterwards.
You can then edit the TGGs on the model transformation control center.
Be aware that changes are currently stored in the browser's local storage.

### Adding Decorators
If you wish to add new decatoratos edit the [`decorators.ts`](src/modules/decorators.ts) file.

### Adding Tabs
To add or alter the tabs of the app edit the [`tabs.ts`](src/components/tabs/tabs.ts) file.

### Adding further modals
Miro allows to extend the UI by allowing to open modal dialogs.
A new modal can be added by defining a new Vue component and registering this component in the [`modal.ts`](src/modal.ts) file.
The new modal can then be called:

```
await miro.board.ui.openPanel({
  url: 'modal.html#ModelName',
  width: 600,
  height: 400,
});
```

Further information on modals is provided in [Miro's developer guide](https://developers.miro.com/docs/websdk-reference-ui).
