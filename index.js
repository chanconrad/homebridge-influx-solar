var Service, Characteristic;


const InfluxDB = require('influx');

const DEF_MIN_LUX = 0,DEF_MAX_LUX = 10000;

const PLUGIN_NAME   = 'homebridge-solar-inverter';
const ACCESSORY_NAME = 'SolarInverter';

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, SolarInverter);
}

const getLastMeasurement = (influx, cb) => {
	influx
	.query(`SELECT LAST(AC_Power) FROM PV`)
	.then(result => cb(null, result[0] == null ? -1 : result[0].last))
	.catch(err => cb(err));
	
};

const round = (value, decimal = 0) => {
	return Math.round((value + Number.EPSILON) * 10 ** decimal) / 10 ** decimal;
};

class SolarInverter {
	constructor(log, config) {
		this.log = log
		this.config = config
		
		this.service = new Service.LightSensor(this.config.name)
		
		this.name = config["name"];
		this.manufacturer = config["manufacturer"];
		this.model = config["model"];
		this.serial = config["serial"];
		this.ip = config["ip"];
		this.inverter_data = config["inverter_data"];
		this.minLux = config["min_lux"] || DEF_MIN_LUX;
		this.maxLux = config["max_lux"] || DEF_MAX_LUX;
		
		this.influx = new InfluxDB.InfluxDB({ ...config['influx'] });
	}
	
	
	getRemoteState = (callback) => {
		getLastMeasurement(
			this.influx,
			(influxError, value) => {
				
				if (influxError) {
					this.log(influxError);
					return callback(new Error(influxError));
				}
				const v = round(value, 1);
				
				this.log(`Current Power:`, v)
				
				this.service.setCharacteristic(Characteristic.Name, 'Solar Inverter');
				this.service.setCharacteristic(Characteristic.CurrentAmbientLightLevel, v);
				return callback(null, v);
			}
			);
		}
		
		getServices () {
			const informationService = new Service.AccessoryInformation()
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)
			
			this.service.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
			.on('get', this.getCurrentAmbientLightLevelHandler.bind(this))
			.setProps({
				minValue: this.minLux
			});
			
			return [informationService, this.service]
		}
		
		async getCurrentAmbientLightLevelHandler (callback) {
			this.getRemoteState(callback)
		}
		
		
	}
	