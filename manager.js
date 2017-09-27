var fs = require('fs');
var bfxTrade =  require("./markets/BitfinexTrade");


var utils = require("./utils");

const SMA = require('technicalindicators').SMA;
const ADX = require('technicalindicators').ADX;
const ATR = require('technicalindicators').ATR;
// var smaSArray={};
// var smaLArray={};
// var adxArray={};

var console = process.console;
const TAG = "Manager";
const pairsList=["XMRBTC", "ETHBTC", "ZECBTC", "LTCBTC", "ETCBTC", "DSHBTC", "XRPBTC"];

const pairsLimits={"XMRBTC" :0.1,
					"ETHBTC":0.01,
					"ZECBTC":0.01,
					"LTCBTC":0.1,
					"ETCBTC":0.1,
					"DSHBTC":0.01,
					"XRPBTC":10};



var pairs = {};
var prevValues={};

const backtest = fale;
const period = 1800*1000;
const accountRiskCoeff = 0.017;
const stopLossCoeff = 2;
const trendStrength = 15;


const longSMA = 100;
const shortSMA = 10;
const adxPeriods =14;
const atrPeriods =14;

//max number of simultaneously opened positions
var maxOpenedPosistions=5; 
//actual number of simultaneously opened positions
var openedPositions=0;
// number of profitable trades
var success =0;
//// number of lost trades
var loss=0;

var hpr =[];
var avgTotalHpr = 1;

var bfx = new bfxTrade(pairsList);

function Manager(){
	
	
	console.log("Initializing list of pairs ");
	//reduce maxOpenedPosistions only for backtesting
	if(backtest){
		maxOpenedPosistions=1;
	}
	
	 for(var pair of pairsList){
	 	pairs[pair] = {
			prevValues : {smaS: -Infinity,
							smaL: Infinity},
			smaSArray:{},
			smaS:0,
			smaLArray:{},
			smaL:0,
			adxArray :{},
			adx:0,
			atrArray :{},
			atr:0,
			long: false,
			short:false,
			stopLossPrice:0,
			entryPrice:0,
			entryAmount : 0, //temporary param
			positionCoeff:1,
			success: 0,
			loss:0,
			hpr:[],
			avgHpr:1

		}
	 }
	
	var self =this;

	if(backtest){
		
		pairs["ETHBTC"]["smaLArray"] = new SMA({period : longSMA, values : []});
		pairs["ETHBTC"]["smaSArray"] = new SMA({period : shortSMA, values : []});
		pairs["ETHBTC"]["adxArray"] = new ADX({period : adxPeriods, close : [], high : [], low : []});
		pairs["ETHBTC"]["atrArray"] = new ATR({period : atrPeriods, close : [], high : [], low : []});
		
	}else{

		//Add ADX for prod mode
		bfx.updateBalance(function(){
			console.log("Initializing indicators ");
			for(pair in pairs){
				bfx.getHistData(pair, period/60000, longSMA, function(resppair, data){
					var short = data.slice(data.length - shortSMA);
					//close
					var farray = [];
					//high
					var harray =[];
					//low
					var larray = [];

					var sarray = [];
					for (var d of data){
						farray.push(d[2]);
						harray.push(d[3]);
						larray.push(d[4]);
					}
					for (var s of short){
						sarray.push(s[2])
					}

					pairs[resppair]["smaLArray"] = new SMA({period : longSMA, values : farray});
					pairs[resppair]["smaSArray"] = new SMA({period : shortSMA, values : sarray});
					pairs[resppair]["adxArray"] = new ADX({period : adxPeriods, close : farray, high : harray, low : larray});	
					pairs[resppair]["atrArray"] = new ATR({period : atrPeriods, close : farray, high : harray, low : larray});	

				});
			}
		});
	}
}



Manager.prototype.runBot = function(){
		var self = this;
		console.log("Starting bot");

		if(backtest){
			console.log("backtest is ON, live data is OFF");
			var marketData = JSON.parse(fs.readFileSync(__dirname+'/datasets/BFX_ETHBTC_30m.json', 'utf8'));
			
			for(var candle of marketData){
				
				updateIndicators(self, "ETHBTC",candle);
				findTradeOpportunity("ETHBTC", candle[2]);
			}
		}else{
			console.log("backtest is OFF, live data is ON");
			var delay = period - Date.now() % period;
			console.log("Bot starts in "+delay/60000+" minutes");
			//get prices via websockets
			bfx.getPrices();
			
			setTimeout(function(){
				console.log("Bot is working");
				//update tech indicators
				for(var pair in pairs){
					updateIndicators(self, pair, bfx.prices);
				}
				setInterval(function(){
					for(var pair in pairs){
						updateIndicators(self, pair, bfx.prices);
					}
				}, period);

				//find trade opportunity
				setInterval(function(){
				
					for(var pair in pairs){
						if(bfx.prices[pair] !=undefined){
							findTradeOpportunity(pair, parseFloat(bfx.prices[pair]["lastPrice"]));
						}		
					}
				}, 5000);
				
			}, delay);	
		}
};



function updateIndicators(self, respair,data){

	var close, high, low =0;
	if(backtest){
		close = data[2];
		high = data[3];
		low = data[4];
	}else{
		close = parseFloat(data[respair]["lastPrice"]);
		high = parseFloat(data[respair]["high"]);
		low = parseFloat(data[respair]["low"]);

	}
	// Updating prev values
	pairs[respair]["prevValues"]["smaS"]=pairs[respair]["smaS"];
	pairs[respair]["prevValues"]["smaL"]=pairs[respair]["smaL"];

	//assigning new sma and adx values
	pairs[respair]["adx"]= pairs[respair]["adxArray"].nextValue({close :close, high: high, low, low})
	pairs[respair]["atr"]= pairs[respair]["atrArray"].nextValue({close :close, high: high, low, low})
	pairs[respair]["smaS"] = pairs[respair]["smaSArray"].nextValue(close);
	pairs[respair]["smaL"] = pairs[respair]["smaLArray"].nextValue(close);

}

function findTradeOpportunity(respair, close){
	
	if(pairs[respair]["adx"] != undefined && 
		pairs[respair]["adx"]["adx"] > trendStrength && 
		!pairs[respair]["long"]&& 
		!pairs[respair]["short"] &&
		openedPositions<maxOpenedPosistions){
		//open long position if conditions are met
		if(pairs[respair]["prevValues"]["smaS"] <pairs[respair]["prevValues"]["smaL"] && 
			pairs[respair]["smaS"]> pairs[respair]["smaL"] ){
			openLongPosition(respair, close);
		//open short position if conditions are met
		} else if(pairs[respair]["prevValues"]["smaS"] >pairs[respair]["prevValues"]["smaL"] && 
			pairs[respair]["smaS"] < pairs[respair]["smaL"]){
			openShortPosition(respair, close);
		}
	}else if(pairs[respair]["long"]){
		//close long position at profit
		if(pairs[respair]["smaS"] < pairs[respair]["smaL"] && 
			pairs[respair]["entryPrice"]*1.01 < close){
			success++; //total
			pairs[respair]["success"]++; //per pair
			closeLongPosition(respair, close);
		// fix losses
		}else if(close < pairs[respair]["stopLossPrice"]){
			loss++; //total
			pairs[respair]["loss"]++; //per pair
			closeLongPosition(respair, pairs[respair]["stopLossPrice"]);
		}
	}else if(pairs[respair]["short"]){
		//close short position at profit
		if(pairs[respair]["smaS"] > pairs[respair]["smaL"] && pairs[respair]["entryPrice"] > close*1.01){
			success++; //total
			pairs[respair]["success"]++; //per pair
			closeShortPosition(respair, close);
		//fix losses
		}else if(close > pairs[respair]["stopLossPrice"]){
			loss++; //total
			pairs[respair]["loss"]++; //per pair
			closeShortPosition(respair, pairs[respair]["stopLossPrice"]);
		}
	}

}

function openLongPosition(respair, close){
	pairs[respair]["stopLossPrice"] = close- stopLossCoeff* pairs[respair]["atr"];
	pairs[respair]["entryAmount"] = getPositionSize(respair, close) //temp
	if(pairs[respair]["entryAmount"] >0){	
		bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
			
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			console.tag("Result").log("----------------------------------------------------");
			pairs[respair]["long"] = true;
							
		});
		openedPositions++;
	}

}

function openShortPosition(respair,close){
	pairs[respair]["stopLossPrice"] = close+ stopLossCoeff* pairs[respair]["atr"];
	pairs[respair]["entryAmount"] = getPositionSize(respair, close) //temp
	if(pairs[respair]["entryAmount"] >0){
		bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
						
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			console.tag("Result").log("----------------------------------------------------");

			pairs[respair]["short"] = true;
			
		});
		openedPositions++;
	}
}

function closeLongPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
		
		hpr.push(close/pairs[respair]["entryPrice"]);
		for (var elem of hpr){
			avgTotalHpr=avgTotalHpr*elem;
		}
		avgTotalHpr = Math.pow(avgTotalHpr,1/hpr.length);

		pairs[respair]["hpr"].push(close/pairs[respair]["entryPrice"]);
		for (var elem of pairs[respair]["hpr"]){
			pairs[respair]["avgHpr"]=pairs[respair]["avgHpr"]*elem;
		}
		pairs[respair]["avgHpr"] = Math.pow(pairs[respair]["avgHpr"],1/pairs[respair]["hpr"].length);


		console.tag("Result").log("Closed long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
		console.tag("Result").log("Result amount " +bfx.initAmout);
		console.tag("Result").log("Total success " +success+" Loss "+loss);
		console.tag("Result").log(respair+" success " +success+" Loss "+loss);
		console.tag("Result").log("Average total HPR " +avgTotalHpr);
		console.tag("Result").log("Average HPR for "+respair+" is " +pairs[respair]["avgHpr"]);

		console.tag("Result").log("----------------------------------------------------");

		pairs[respair]["long"] = false;
		pairs[respair]["entryPrice"] = 0;
		pairs[respair]["entryAmount"] = 0; //temp
		pairs[respair]["stopLossPrice"]=0
		
						
	});
	openedPositions--;
}

function closeShortPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
		
		hpr.push(pairs[respair]["entryPrice"]/close);
		for (var elem of hpr){
			avgTotalHpr=avgTotalHpr*elem;
		}
		avgTotalHpr = Math.pow(avgTotalHpr,1/hpr.length);

		pairs[respair]["hpr"].push(pairs[respair]["entryPrice"]/close);
		for (var elem of pairs[respair]["hpr"]){
			pairs[respair]["avgHpr"]=pairs[respair]["avgHpr"]*elem;
		}
		pairs[respair]["avgHpr"] = Math.pow(pairs[respair]["avgHpr"],1/pairs[respair]["hpr"].length);


		console.tag("Result").log("Closed short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
		console.tag("Result").log("Result amount " +bfx.initAmout);
		console.tag("Result").log("Total success " +success+" Loss "+loss);
		console.tag("Result").log(respair+" success " +success+" Loss "+loss);
		console.tag("Result").log("Average total HPR " +avgTotalHpr);
		console.tag("Result").log("Average HPR for "+respair+" is " +pairs[respair]["avgHpr"]);

		console.tag("Result").log("----------------------------------------------------");
	
		pairs[respair]["short"] = false;
		pairs[respair]["entryPrice"] = 0;
		pairs[respair]["entryAmount"] = 0; //temp
		pairs[respair]["stopLossPrice"]=0
		
						
	});
	openedPositions--;
}

function getPositionSize(respair, close){

	if(pairs[respair]["hpr"].length %3 ==0){
		if(pairs[respair]["avgHpr"]<1){
			
			pairs[respair]["positionCoeff"]=pairs[respair]["positionCoeff"]-0.1;
			if(pairs[respair]["positionCoeff"] <0.1 ){
				pairs[respair]["positionCoeff"]=0.1;
			}

			console.tag("Result").log("Position coeff reduced "+pairs[respair]["positionCoeff"] );
			

		}else{
			
			pairs[respair]["positionCoeff"]=pairs[respair]["positionCoeff"]+0.1;
			if(pairs[respair]["positionCoeff"] >1 ){
				pairs[respair]["positionCoeff"]=1;
			}
			console.tag("Result").log("Position coeff uplifted "+pairs[respair]["positionCoeff"] );

			

		}
	}
	var tradeRisk = 0;
	
	if(pairs[respair]["stopLossPrice"] < close){
		
		tradeRisk=Math.max.apply(Math,[(pairs[respair]["stopLossPrice"]/close), accountRiskCoeff]);
	}else{
		tradeRisk=Math.max.apply(Math, [(close/pairs[respair]["stopLossPrice"]), accountRiskCoeff]);

	}
	console.log(tradeRisk);
	//var positionSize = pairs[respair]["positionCoeff"]*bfx.initAmout/((maxOpenedPosistions-openedPositions)*close);
	var positionSize = ((bfx.initAmout/(maxOpenedPosistions-openedPositions))*pairs[respair]["positionCoeff"]*tradeRisk)/close;

	if(positionSize > pairsLimits[respair]){
		return positionSize;
	}else{
		console.tag("Result").log(respair+" Order is too small " +positionSize);
		return -1;
	}
	
	
}




module.exports = Manager;