var MongoClient = require('mongodb').MongoClient

var url = 'mongodb://ma-bot:P%40ssw0rd@ds147044.mlab.com:47044/ma-bot-db';

function DBClient(){


}

DBClient.prototype.saveTrade = function(pair, type, price, amount){
	MongoClient.connect(url, function(err, db) {
  		db.collection('trades').insertOne(
  			{time: Date.now(),
  			pair: pair, 
  			type: type,
  			price: price,
  			amount: amount});
  		db.close();
	});
}


module.exports = DBClient;