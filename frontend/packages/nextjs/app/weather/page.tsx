"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { ArrowLeftIcon, CloudIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

interface WeatherData {
  rainfall30d: bigint;
  rainfall24h: bigint;
  temperature: bigint;
  timestamp: bigint;
  isValid: boolean;
}

const Weather: NextPage = () => {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [showWeather, setShowWeather] = useState(false);

  // Get weather data for location
  const { data: weatherData, refetch: refetchWeather } = useScaffoldReadContract({
    contractName: "WeatherOracle",
    functionName: "getWeatherData",
    args: [
      latitude && longitude ? BigInt(Math.round(parseFloat(latitude) * 10000)) : BigInt(0),
      latitude && longitude ? BigInt(Math.round(parseFloat(longitude) * 10000)) : BigInt(0)
    ],
    enabled: false, // Don't auto-fetch
  });

  // Check if data is fresh
  const { data: isDataFresh } = useScaffoldReadContract({
    contractName: "WeatherOracle",
    functionName: "isDataFresh",
    args: [
      latitude && longitude ? BigInt(Math.round(parseFloat(latitude) * 10000)) : BigInt(0),
      latitude && longitude ? BigInt(Math.round(parseFloat(longitude) * 10000)) : BigInt(0),
      BigInt(24 * 60 * 60) // 24 hours
    ],
    enabled: showWeather && latitude && longitude,
  });

  // Get user's location
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please enter coordinates manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Check weather for location
  const handleCheckWeather = async () => {
    if (!latitude || !longitude) {
      alert("Please enter coordinates first");
      return;
    }

    try {
      await refetchWeather();
      setShowWeather(true);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      alert("Error fetching weather data. Location may not have data available.");
    }
  };

  // Format weather values
  const formatRainfall = (value: bigint) => {
    return (Number(value) / 1000).toFixed(1); // Convert from scaled format
  };

  const formatTemperature = (value: bigint) => {
    return (Number(value) / 1000).toFixed(1); // Convert from scaled format
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  // Check risk levels
  const getRiskLevel = (data: WeatherData) => {
    const rainfall30d = Number(data.rainfall30d) / 1000;
    const rainfall24h = Number(data.rainfall24h) / 1000;
    const temperature = Number(data.temperature) / 1000;

    const risks = [];
    
    if (rainfall30d < 5) {
      risks.push({ type: "Severe Drought", level: "high", description: "Less than 5mm in 30 days" });
    } else if (rainfall30d < 25) {
      risks.push({ type: "Drought Risk", level: "medium", description: "Low rainfall in 30 days" });
    }

    if (rainfall24h > 200) {
      risks.push({ type: "Severe Flood", level: "high", description: "More than 200mm in 24 hours" });
    } else if (rainfall24h > 100) {
      risks.push({ type: "Flood Risk", level: "medium", description: "High rainfall in 24 hours" });
    }

    if (temperature > 55) {
      risks.push({ type: "Extreme Heat", level: "high", description: "Temperature above 55°C" });
    } else if (temperature > 40) {
      risks.push({ type: "Heat Risk", level: "medium", description: "High temperature" });
    }

    return risks;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link href="/" className="btn btn-ghost btn-sm mr-4">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-3xl font-bold">Weather Monitor</h1>
      </div>

      {/* Location Input */}
      <div className="bg-base-100 p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-xl font-bold mb-4">Check Weather Data</h2>
        
        <div className="mb-4">
          <label className="label">
            <span className="label-text font-medium">Farm Location (Africa Only)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              step="0.000001"
              className="input input-bordered flex-1"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="Latitude (e.g., -1.2921)"
            />
            <input
              type="number"
              step="0.000001"
              className="input input-bordered flex-1"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="Longitude (e.g., 36.8219)"
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              className="btn btn-outline btn-sm"
              onClick={handleGetLocation}
            >
              <MapPinIcon className="h-4 w-4 mr-2" />
              Use My Location
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCheckWeather}
              disabled={!latitude || !longitude}
            >
              <CloudIcon className="h-4 w-4 mr-2" />
              Check Weather
            </button>
          </div>
        </div>
      </div>

      {/* Weather Data Display */}
      {showWeather && weatherData && (weatherData as WeatherData).isValid && (
        <div className="space-y-6">
          {/* Data Freshness */}
          <div className="bg-base-100 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`badge ${isDataFresh ? 'badge-success' : 'badge-warning'}`}>
                {isDataFresh ? 'Fresh Data' : 'Stale Data'}
              </div>
              <span className="text-sm text-base-content/70">
                Last updated: {formatDate((weatherData as WeatherData).timestamp)}
              </span>
            </div>
          </div>

          {/* Weather Metrics */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-base-100 p-6 rounded-lg shadow-lg text-center">
              <div className="text-3xl mb-2">🌧️</div>
              <div className="text-2xl font-bold text-primary">
                {formatRainfall((weatherData as WeatherData).rainfall30d)} mm
              </div>
              <div className="text-sm text-base-content/70">Rainfall (30 days)</div>
            </div>

            <div className="bg-base-100 p-6 rounded-lg shadow-lg text-center">
              <div className="text-3xl mb-2">💧</div>
              <div className="text-2xl font-bold text-info">
                {formatRainfall((weatherData as WeatherData).rainfall24h)} mm
              </div>
              <div className="text-sm text-base-content/70">Rainfall (24 hours)</div>
            </div>

            <div className="bg-base-100 p-6 rounded-lg shadow-lg text-center">
              <div className="text-3xl mb-2">🌡️</div>
              <div className="text-2xl font-bold text-warning">
                {formatTemperature((weatherData as WeatherData).temperature)}°C
              </div>
              <div className="text-sm text-base-content/70">Temperature</div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-base-100 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">Risk Assessment</h3>
            {(() => {
              const risks = getRiskLevel(weatherData as WeatherData);
              if (risks.length === 0) {
                return (
                  <div className="flex items-center gap-2 text-success">
                    <div className="badge badge-success">Low Risk</div>
                    <span>Weather conditions are within normal ranges</span>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  {risks.map((risk, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className={`badge ${risk.level === 'high' ? 'badge-error' : 'badge-warning'}`}>
                        {risk.level === 'high' ? 'High Risk' : 'Medium Risk'}
                      </div>
                      <span className="font-medium">{risk.type}</span>
                      <span className="text-sm text-base-content/70">- {risk.description}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Insurance Triggers */}
          <div className="bg-base-100 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">Insurance Trigger Thresholds</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-error/10 rounded-lg">
                <div className="font-bold text-error mb-2">Severe Drought</div>
                <div className="text-sm">
                  <div>&lt; 5mm rainfall in 30 days</div>
                  <div className="text-success font-medium">100% payout</div>
                </div>
              </div>
              <div className="p-4 bg-error/10 rounded-lg">
                <div className="font-bold text-error mb-2">Severe Flood</div>
                <div className="text-sm">
                  <div>&gt; 200mm rainfall in 24 hours</div>
                  <div className="text-success font-medium">100% payout</div>
                </div>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg">
                <div className="font-bold text-warning mb-2">Extreme Heat</div>
                <div className="text-sm">
                  <div>&gt; 55°C temperature</div>
                  <div className="text-success font-medium">75% payout</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {showWeather && (!weatherData || !(weatherData as WeatherData).isValid) && (
        <div className="bg-base-100 p-6 rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">🌤️</div>
          <h3 className="text-xl font-bold mb-2">No Weather Data Available</h3>
          <p className="text-base-content/70">
            Weather data is not available for this location. Please try a different location or check back later.
          </p>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-info/10 p-6 rounded-lg">
        <h3 className="font-bold text-info mb-4">About Weather Monitoring</h3>
        <div className="text-sm text-base-content/70 space-y-2">
          <p>• Weather data is updated regularly by our oracle system</p>
          <p>• Data freshness is checked to ensure accuracy</p>
          <p>• Risk assessment helps you understand potential insurance triggers</p>
          <p>• Only locations within Africa are supported</p>
          <p>• Weather triggers are automatically processed for active policies</p>
        </div>
      </div>
    </div>
  );
};

export default Weather;