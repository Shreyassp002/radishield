class WeatherValidator {
  constructor() {
    // Define validation ranges based on requirements 2.5 and 5.2
    this.validationRules = {
      temperature: {
        min: -100, // Celsius - extreme cold (Antarctica record: -89.2°C)
        max: 100, // Celsius - extreme heat (Death Valley record: 54.4°C)
      },
      rainfall30d: {
        min: 0, // mm - cannot be negative
        max: 10000, // mm - extreme rainfall (10 meters total in 30 days)
      },
      rainfall24h: {
        min: 0, // mm - cannot be negative
        max: 1000, // mm - extreme daily rainfall (1 meter in 24 hours)
      },
      timestamp: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      },
    };
  }

  /**
   * Validate weather data against defined ranges and logic rules
   * @param {Object} weatherData - Weather data to validate
   * @returns {Object} Validation result with isValid flag and errors
   */
  validateWeatherData(weatherData) {
    const errors = [];
    const warnings = [];

    // Check required fields
    const requiredFields = [
      "rainfall30d",
      "rainfall24h",
      "temperature",
      "timestamp",
    ];
    for (const field of requiredFields) {
      if (weatherData[field] === undefined || weatherData[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        warnings,
        weatherData: null,
      };
    }

    // Validate temperature range
    if (
      !this.isInRange(weatherData.temperature, this.validationRules.temperature)
    ) {
      errors.push(
        `Temperature ${weatherData.temperature}°C is outside valid range ` +
          `(${this.validationRules.temperature.min}°C to ${this.validationRules.temperature.max}°C)`
      );
    }

    // Validate 30-day rainfall range
    if (
      !this.isInRange(weatherData.rainfall30d, this.validationRules.rainfall30d)
    ) {
      errors.push(
        `30-day rainfall ${weatherData.rainfall30d}mm is outside valid range ` +
          `(${this.validationRules.rainfall30d.min}mm to ${this.validationRules.rainfall30d.max}mm)`
      );
    }

    // Validate 24-hour rainfall range
    if (
      !this.isInRange(weatherData.rainfall24h, this.validationRules.rainfall24h)
    ) {
      errors.push(
        `24-hour rainfall ${weatherData.rainfall24h}mm is outside valid range ` +
          `(${this.validationRules.rainfall24h.min}mm to ${this.validationRules.rainfall24h.max}mm)`
      );
    }

    // Logic validation: 24h rainfall should not exceed 30-day rainfall
    if (weatherData.rainfall24h > weatherData.rainfall30d) {
      errors.push(
        `24-hour rainfall (${weatherData.rainfall24h}mm) cannot exceed ` +
          `30-day rainfall (${weatherData.rainfall30d}mm)`
      );
    }

    // Validate timestamp freshness (max 24 hours old)
    const dataAge = Date.now() - weatherData.timestamp;
    if (dataAge > this.validationRules.timestamp.maxAge) {
      const hoursOld = Math.round(dataAge / (60 * 60 * 1000));
      errors.push(
        `Weather data is too old: ${hoursOld} hours (max 24 hours allowed)`
      );
    }

    // Add warnings for suspicious but not invalid data
    if (weatherData.temperature > 50) {
      warnings.push(`Extremely high temperature: ${weatherData.temperature}°C`);
    }
    if (weatherData.temperature < -50) {
      warnings.push(`Extremely low temperature: ${weatherData.temperature}°C`);
    }
    if (weatherData.rainfall24h > 200) {
      warnings.push(`Very high 24-hour rainfall: ${weatherData.rainfall24h}mm`);
    }
    if (weatherData.rainfall30d > 2000) {
      warnings.push(`Very high 30-day rainfall: ${weatherData.rainfall30d}mm`);
    }

    // Create validated weather data with validation flag
    const validatedData = {
      ...weatherData,
      isValid: errors.length === 0,
      validatedAt: Date.now(),
      validationSource: "weather-validator",
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      weatherData: validatedData,
    };
  }

  /**
   * Check if a value is within the specified range
   * @param {number} value - Value to check
   * @param {Object} range - Range object with min and max properties
   * @returns {boolean} True if value is within range
   */
  isInRange(value, range) {
    return value >= range.min && value <= range.max;
  }

  /**
   * Validate GPS coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} Validation result for coordinates
   */
  validateCoordinates(latitude, longitude) {
    const errors = [];

    // Validate latitude range (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      errors.push(`Invalid latitude: ${latitude} (must be between -90 and 90)`);
    }

    // Validate longitude range (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      errors.push(
        `Invalid longitude: ${longitude} (must be between -180 and 180)`
      );
    }

    // Check for null/undefined values
    if (latitude === null || latitude === undefined) {
      errors.push("Latitude is required");
    }
    if (longitude === null || longitude === undefined) {
      errors.push("Longitude is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
      coordinates: errors.length === 0 ? { latitude, longitude } : null,
    };
  }

  /**
   * Sanitize weather data by rounding to appropriate decimal places
   * @param {Object} weatherData - Raw weather data
   * @returns {Object} Sanitized weather data
   */
  sanitizeWeatherData(weatherData) {
    return {
      ...weatherData,
      rainfall30d: Math.round(weatherData.rainfall30d * 100) / 100, // 2 decimal places
      rainfall24h: Math.round(weatherData.rainfall24h * 100) / 100, // 2 decimal places
      temperature: Math.round(weatherData.temperature * 100) / 100, // 2 decimal places
      timestamp: Math.floor(weatherData.timestamp), // Remove decimal places from timestamp
    };
  }

  /**
   * Get validation rules for external reference
   * @returns {Object} Current validation rules
   */
  getValidationRules() {
    return { ...this.validationRules };
  }

  /**
   * Update validation rules (for testing or configuration)
   * @param {Object} newRules - New validation rules to merge
   */
  updateValidationRules(newRules) {
    this.validationRules = {
      ...this.validationRules,
      ...newRules,
    };
  }
}

module.exports = WeatherValidator;
