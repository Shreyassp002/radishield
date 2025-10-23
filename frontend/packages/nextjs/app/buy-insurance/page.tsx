"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const BuyInsurance: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  // Form state
  const [cropType, setCropType] = useState("");
  const [coverage, setCoverage] = useState("1");
  const [duration, setDuration] = useState("30");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [premium, setPremium] = useState<bigint | null>(null);

  // Contract interactions
  const { writeContractAsync: createPolicy, isPending: isCreatingPolicy } = useScaffoldWriteContract("RadiShield");
  const [isCalculatingPremium, setIsCalculatingPremium] = useState(false);

  // Calculate premium using read contract
  const handleCalculatePremium = async () => {
    if (!coverage || !latitude || !longitude) return;

    setIsCalculatingPremium(true);
    try {
      // Simple calculation: 7% of coverage amount
      const coverageWei = parseEther(coverage);
      const calculatedPremium = (coverageWei * BigInt(700)) / BigInt(10000);
      setPremium(calculatedPremium);
    } catch (error) {
      console.error("Error calculating premium:", error);
      alert("Error calculating premium. Please try again.");
    } finally {
      setIsCalculatingPremium(false);
    }
  };

  // Create insurance policy
  const handleCreatePolicy = async () => {
    if (!cropType || !coverage || !duration || !latitude || !longitude || !premium) {
      alert("Please fill all fields and calculate premium first");
      return;
    }

    // Validate African coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (lat < -35 || lat > 37 || lon < -18 || lon > 52) {
      alert("Coordinates must be within Africa: Latitude -35° to 37°, Longitude -18° to 52°");
      return;
    }

    try {
      const coverageWei = parseEther(coverage);
      const durationSeconds = BigInt(parseInt(duration) * 24 * 60 * 60);
      // Contract scales coordinates by 10000 internally, so send the raw integer part
      // Example: -1.292 latitude becomes -1, 36.822 longitude becomes 37
      const latScaled = BigInt(Math.round(parseFloat(latitude)));
      const lonScaled = BigInt(Math.round(parseFloat(longitude)));

      console.log("Sending coordinates:", { latScaled, lonScaled, latitude, longitude });
      console.log("After contract scaling (×10000):", {
        scaledLat: Number(latScaled) * 10000,
        scaledLon: Number(lonScaled) * 10000,
      });

      await createPolicy({
        functionName: "createPolicy",
        args: [cropType, coverageWei, durationSeconds, latScaled, lonScaled],
        value: premium,
      });

      alert("Insurance policy created successfully!");
      // Reset form
      setCropType("");
      setCoverage("1");
      setDuration("30");
      setLatitude("");
      setLongitude("");
      setPremium(null);
    } catch (error) {
      console.error("Error creating policy:", error);
      alert("Error creating policy. Please try again.");
    }
  };

  // Get user's location
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        error => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please enter coordinates manually.");
        },
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  if (!connectedAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-6">
        <div className="max-w-lg mx-auto text-center animate-fade-in">
          <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-8 rounded-3xl w-fit mx-auto mb-8 shadow-xl">
            <ShieldCheckIcon className="h-20 w-20 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Connect Your Wallet</h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Connect your wallet to access parametric crop insurance and protect your harvest
          </p>
          <Link href="/" className="btn btn-primary text-lg px-8 py-4">
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <div className="mb-12 animate-fade-in">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-gray-600 hover:text-primary mb-8 transition-all duration-300 text-lg font-medium group"
          >
            <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-300" />
            Back to Home
          </Link>
          <div className="text-center">
            <p className="text-lg text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Get parametric crop insurance with automatic payouts based on weather conditions
            </p>
          </div>
        </div>

        {/* Insurance Form */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Policy Details Section */}
            <div className="form-section">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Policy Details</h2>

              {/* Crop Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Crop Type</label>
                <select className="select w-full" value={cropType} onChange={e => setCropType(e.target.value)}>
                  <option value="">Select your crop type</option>
                  <option value="maize">Maize (Corn)</option>
                  <option value="coffee">Coffee</option>
                  <option value="tea">Tea</option>
                  <option value="rice">Rice</option>
                  <option value="wheat">Wheat</option>
                  <option value="cassava">Cassava</option>
                  <option value="beans">Beans</option>
                  <option value="sorghum">Sorghum</option>
                </select>
              </div>

              {/* Coverage Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coverage Amount
                  <span className="text-gray-500 font-normal ml-2">(1-10 C2FLR)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  className="input w-full"
                  value={coverage}
                  onChange={e => setCoverage(e.target.value)}
                  placeholder="Enter coverage amount"
                />
                <p className="text-sm text-gray-500 mt-1">Higher coverage provides better protection for your crops</p>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Duration
                  <span className="text-gray-500 font-normal ml-2">(30-365 days)</span>
                </label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  className="input w-full"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="Enter duration in days"
                />
                <p className="text-sm text-gray-500 mt-1">Longer duration provides extended protection</p>
              </div>

              {/* Farm Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Farm Location
                  <span className="text-gray-500 font-normal ml-2">
                    (Africa only: Lat -35° to 37°, Lon -18° to 52°)
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <input
                    type="number"
                    step="0.000001"
                    className="input w-full"
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                    placeholder="Latitude (e.g., -1.292)"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    className="input w-full"
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                    placeholder="Longitude (e.g., 36.822)"
                  />
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleGetLocation}>
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  Use My Location
                </button>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your farm coordinates for accurate weather monitoring
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Premium Calculation */}
            <div className="form-section">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Premium Calculation</h3>

              <div className="space-y-4">
                <button
                  type="button"
                  className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    isCalculatingPremium || !coverage || !latitude || !longitude
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  }`}
                  onClick={handleCalculatePremium}
                  disabled={isCalculatingPremium || !coverage || !latitude || !longitude}
                >
                  {isCalculatingPremium ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                      Calculating Premium...
                    </>
                  ) : (
                    <>
                      <CurrencyDollarIcon className="h-5 w-5" />
                      Calculate Premium
                    </>
                  )}
                </button>

                {premium && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 animate-fade-in">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        <p className="text-sm font-semibold text-green-700">Premium Calculated</p>
                      </div>
                      <p className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                        {formatEther(premium)} C2FLR
                      </p>
                      <p className="text-sm text-gray-600">7% of coverage amount</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Policy Summary */}
            {premium && (
              <div className="form-section">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Policy Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Crop Type:</span>
                    <span className="font-medium capitalize">{cropType || "Not selected"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coverage:</span>
                    <span className="font-medium">{coverage} C2FLR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{duration} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium text-sm">
                      {latitude && longitude ? `${latitude}, ${longitude}` : "Not set"}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Premium:</span>
                    <span className="text-primary">{formatEther(premium)} C2FLR</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create Policy Button */}
            <button
              type="button"
              className={`w-full px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                isCreatingPolicy || !premium
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              }`}
              onClick={handleCreatePolicy}
              disabled={isCreatingPolicy || !premium}
            >
              {isCreatingPolicy ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-gray-400 border-t-transparent"></div>
                  Creating Policy...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-6 w-6" />
                  Create Policy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Coverage Information */}
        <div className="mt-8 card p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="h-6 w-6 text-primary" />
            Coverage Information
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Weather Triggers</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>
                    <strong>Severe Drought:</strong> &lt;5mm rainfall in 30 days (100% payout)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>
                    <strong>Severe Flood:</strong> &gt;200mm rainfall in 24 hours (100% payout)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>
                    <strong>Extreme Heatwave:</strong> &gt;55°C temperature (75% payout)
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Key Features</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Automatic payouts based on weather data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>No paperwork required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Africa coverage only</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Blockchain transparency</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyInsurance;
