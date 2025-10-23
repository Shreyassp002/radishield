"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ArrowLeftIcon, MapPinIcon, CurrencyDollarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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
  
  // Use read contract for calculatePremium since it's a view function
  // calculatePremium expects pre-scaled coordinates (multiplied by 10000)
  // So for -1.2921, we pass -12921 (scaled by 10000)
  const { data: calculatedPremium, refetch: refetchPremium, isLoading: isCalculatingPremium } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "calculatePremium",
    args: coverage && latitude && longitude ? [
      parseEther(coverage),
      BigInt(Math.round(parseFloat(latitude) * 10000)),
      BigInt(Math.round(parseFloat(longitude) * 10000))
    ] : undefined,
  });

  // Calculate premium when form changes
  const handleCalculatePremium = async () => {
    if (!coverage || !latitude || !longitude) return;
    
    try {
      const result = await refetchPremium();
      if (result.data) {
        setPremium(result.data as bigint);
      }
    } catch (error) {
      console.error("Error calculating premium:", error);
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
      const durationSeconds = BigInt(parseInt(duration) * 24 * 60 * 60); // Convert days to seconds
      // createPolicy expects coordinates as simple integers (degrees)
      // The contract will scale them by 10000 internally
      // So -1.2921 becomes -1, and 36.8219 becomes 37 (rounded to nearest integer)
      const lat = BigInt(Math.round(parseFloat(latitude)));
      const lon = BigInt(Math.round(parseFloat(longitude)));

      await createPolicy({
        functionName: "createPolicy",
        args: [cropType, coverageWei, durationSeconds, lat, lon],
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

  if (!connectedAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-primary/10 p-6 rounded-2xl w-fit mx-auto mb-6">
            <ShieldCheckIcon className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
          <p className="text-gray-600 mb-8">Connect your wallet to purchase insurance</p>
          <Link href="/" className="btn btn-primary">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-6 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Buy Insurance</h1>
            <p className="text-xl text-gray-600">Protect your crops</p>
          </div>
        </div>

        {/* Connected Address */}
        <div className="card p-6 mb-8 text-center">
          <p className="text-sm font-medium text-gray-600 mb-2">Connected Wallet</p>
          <Address address={connectedAddress} />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crop Type
                </label>
                <select 
                  className="select w-full"
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                >
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
                  onChange={(e) => setCoverage(e.target.value)}
                  placeholder="Enter coverage amount"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Higher coverage provides better protection for your crops
                </p>
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
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Enter duration in days"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Longer duration provides extended protection
                </p>
              </div>
            </div>

            {/* Location Section */}
            <div className="form-section">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Farm Location</h3>
              <p className="text-sm text-gray-600 mb-4">
                Coverage is available for farms located within Africa (Lat: -35° to 37°, Lon: -18° to 52°)
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    className="input w-full"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g., -1.292 (Nairobi)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    className="input w-full"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g., 36.822 (Nairobi)"
                  />
                </div>
              </div>
              
              <button 
                type="button" 
                className="btn btn-outline w-full sm:w-auto"
                onClick={handleGetLocation}
              >
                <MapPinIcon className="h-4 w-4 mr-2" />
                Use My Current Location
              </button>
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
                  className="btn btn-primary w-full"
                  onClick={handleCalculatePremium}
                  disabled={isCalculatingPremium || !coverage || !latitude || !longitude}
                >
                  {isCalculatingPremium ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Calculating Premium...
                    </>
                  ) : (
                    <>
                      <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                      Calculate Premium
                    </>
                  )}
                </button>
                
                {premium && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-1">Premium Amount</p>
                      <p className="text-3xl font-bold text-primary">
                        {formatEther(premium)} C2FLR
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        7% of coverage amount
                      </p>
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
              className="btn btn-primary w-full text-lg py-4"
              onClick={handleCreatePolicy}
              disabled={isCreatingPolicy || !premium}
            >
              {isCreatingPolicy ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating Policy...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-6 w-6 mr-2" />
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
                  <span><strong>Severe Drought:</strong> &lt;5mm rainfall in 30 days (100% payout)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Severe Flood:</strong> &gt;200mm rainfall in 24 hours (100% payout)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Extreme Heatwave:</strong> &gt;55°C temperature (75% payout)</span>
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