// Global variables
let map;
let service;
let userMarker;
let userLocation;
let markers = [];
let places = [];
let searchRadius = 5000; // Default: 5km
let radiusCircle;
let customLocationMode = false;
let filterFakePlaces = true;

// Place categories
const placeCategories = [
    { type: "hospital", icon: "fa-hospital", label: "Hospitals", color: "#ef4444" },
    { type: "police", icon: "fa-building-shield", label: "Police Stations", color: "#3b82f6" },
    { type: "pharmacy", icon: "fa-prescription-bottle-medical", label: "Pharmacies", color: "#22c55e" },
    { type: "school", icon: "fa-school", label: "Schools", color: "#f97316" },
    { type: "bank", icon: "fa-landmark", label: "Banks", color: "#6366f1" },
    { type: "restaurant", icon: "fa-utensils", label: "Restaurants", color: "#ec4899" },
    { type: "supermarket", icon: "fa-shopping-cart", label: "Grocery Stores", color: "#14b8a6" },
    { type: "airport", icon: "fa-plane", label: "Airports", color: "#8b5cf6", specialRadius: true },
    { type: "train_station", icon: "fa-train", label: "Train Stations", color: "#f59e0b", specialRadius: true }
];

// Initialize app
function initApp() {
    console.log("App initializing");
    
    // Set up event listeners
    document.getElementById('search-btn').addEventListener('click', updateRadius);
    document.getElementById('recenter-btn').addEventListener('click', recenterMap);
    document.getElementById('custom-location-btn').addEventListener('click', toggleCustomLocationMode);
    document.getElementById('sort-select').addEventListener('change', function(e) {
        sortPlaces(e.target.value);
    });
    document.getElementById('fake-filter').addEventListener('change', function(e) {
        filterFakePlaces = e.target.checked;
        findNearbyPlaces();
    });
    document.getElementById('about-btn').addEventListener('click', showAbout);
    document.getElementById('location-search-btn').addEventListener('click', searchLocation);
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchLocation();
    });
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    
    // Set up filter options
    setupFilterOptions();
    
    // Initialize map
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        initializeMap();
    } else {
        document.querySelector('.loading-indicator').innerHTML = 
            '<i class="fas fa-exclamation-triangle"></i><span>Google Maps failed to load. Please check your internet connection and reload.</span>';
    }
}

// Set up filter options
function setupFilterOptions() {
    const filterContainer = document.getElementById('filter-options');
    if (!filterContainer) return;
    
    // Clear existing options
    filterContainer.innerHTML = '';
    
    // Add "All" option
    const allChip = document.createElement('div');
    allChip.className = 'filter-chip active';
    allChip.dataset.category = 'all';
    allChip.textContent = 'All';
    allChip.addEventListener('click', function() {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        filterPlacesByCategory('all');
    });
    filterContainer.appendChild(allChip);
    
    // Add each category
    placeCategories.forEach(category => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.dataset.category = category.type;
        chip.textContent = category.label;
        chip.addEventListener('click', function() {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            filterPlacesByCategory(category.type);
        });
        filterContainer.appendChild(chip);
    });
}

// Initialize map
function initializeMap() {
    document.querySelector('.loading-indicator').innerHTML = 
        '<i class="fas fa-spinner fa-spin"></i><span>Getting your location...</span>';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // Success callback
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                createMap(userLocation);
            },
            function(error) {
                // Error callback - use default location
                document.querySelector('.loading-indicator').innerHTML = 
                    '<i class="fas fa-exclamation-triangle"></i><span>Could not access your location. Using default.</span>';
                userLocation = { lat: 40.7128, lng: -74.0060 }; // Default: New York
                createMap(userLocation);
            }
        );
    } else {
        // Geolocation not supported
        document.querySelector('.loading-indicator').innerHTML = 
            '<i class="fas fa-exclamation-triangle"></i><span>Geolocation not supported. Using default location.</span>';
        userLocation = { lat: 40.7128, lng: -74.0060 }; // Default: New York
        createMap(userLocation);
    }
}

// Create map
function createMap(center) {
    try {
        // Create map
        map = new google.maps.Map(document.getElementById('map'), {
            center: center,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });
        
        // Add user marker
        userMarker = new google.maps.Marker({
            position: center,
            map: map,
            title: "Your location",
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#3b82f6",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            },
            zIndex: 1000
        });
        
        // Add radius circle
        radiusCircle = new google.maps.Circle({
            strokeColor: "#3b82f6",
            strokeOpacity: 0.3,
            strokeWeight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            map: map,
            center: center,
            radius: searchRadius,
            clickable: false
        });
        
        // Add click listener for custom location
        map.addListener('click', function(event) {
            if (customLocationMode) {
                setCustomLocation(event.latLng);
            }
        });
        
        // Search for nearby places
        findNearbyPlaces();
        
    } catch (error) {
        console.error("Error creating map:", error);
        document.querySelector('.loading-indicator').innerHTML = 
            '<i class="fas fa-exclamation-triangle"></i><span>Error creating map. Please try again.</span>';
    }
}

// Find nearby places
function findNearbyPlaces() {
    clearResults();
    
    document.querySelector('.loading-indicator').innerHTML = 
        '<i class="fas fa-spinner fa-spin"></i><span>Finding nearby places...</span>';
    
    // Create places service
    service = new google.maps.places.PlacesService(map);
    
    // Track completion
    let completedRequests = 0;
    
    // Search for each category
    placeCategories.forEach(category => {
        const radius = category.specialRadius ? 300000 : searchRadius;
        
        service.nearbySearch({
            location: userLocation,
            radius: radius,
            type: category.type
        }, function(results, status) {
            completedRequests++;
            
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                processResults(results, category);
            }
            
            // Check if all requests are complete
            if (completedRequests === placeCategories.length) {
                if (places.length > 0) {
                    displayPlaces();
                } else {
                    document.querySelector('.loading-indicator').innerHTML = 
                        '<i class="fas fa-info-circle"></i><span>No places found in this area.</span>';
                }
            }
        });
    });
}

// Process search results
function processResults(results, category) {
    // Filter to places with ratings
    const ratedPlaces = results.filter(place => place.rating && place.user_ratings_total > 0);
    
    // Filter out fake places if enabled
    const filteredPlaces = filterFakePlaces ? 
        ratedPlaces.filter(place => !isFakePlace(place)) : ratedPlaces;
    
    // Get top rated places
    const topPlaces = filteredPlaces
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3);
    
    // Add to places array
    topPlaces.forEach(place => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(userLocation.lat, userLocation.lng),
            place.geometry.location
        );
        
        places.push({
            id: place.place_id,
            name: place.name,
            location: place.geometry.location,
            distance: distance,
            category: category.type,
            categoryLabel: category.label,
            categoryIcon: category.icon,
            categoryColor: category.color,
            rating: place.rating,
            vicinity: place.vicinity,
            photos: place.photos,
            user_ratings_total: place.user_ratings_total
        });
    });
}

// Check if a place might be fake
function isFakePlace(place) {
    const name = place.name.toLowerCase();
    const vicinity = (place.vicinity || "").toLowerCase();
    
    // Check for suspicious keywords
    const suspiciousWords = ["fake", "test", "placeholder", "contribution", "demo"];
    if (suspiciousWords.some(word => name.includes(word) || vicinity.includes(word))) {
        return true;
    }
    
    // Perfect rating but few reviews
    if (place.rating === 5.0 && place.user_ratings_total < 10) {
        return true;
    }
    
    // Generic name for certain categories
    if (place.types && 
        (place.types.includes("hospital") || 
         place.types.includes("police") || 
         place.types.includes("school")) && 
        name.split(' ').length <= 2) {
        return true;
    }
    
    return false;
}

// Display places on map and in list
function displayPlaces() {
    // Group places by category
    const placesByCategory = {};
    places.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Clear results container
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    // Display empty state if no places
    if (places.length === 0) {
        resultsContainer.innerHTML = 
            '<div class="loading-indicator"><i class="fas fa-info-circle"></i><span>No places found in this area.</span></div>';
        return;
    }
    
    // For each category with places
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const category = placeCategories.find(c => c.type === categoryKey);
        
        if (!category) return;
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'place-category';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-icon" style="background-color: ${category.color}20; color: ${category.color}">
                <i class="fas ${category.icon}"></i>
            </div>
            <h3>${category.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'place-card';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4>${place.name}</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="place-details-row">
                    <div class="rating">
                        <i class="fas fa-star"></i>
                        <span>${place.rating.toFixed(1)}</span>
                        <span class="review-count">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Filter places by category
function filterPlacesByCategory(category) {
    // Clear existing markers
    clearMarkers();
    
    // Get filtered places
    const filtered = category === 'all' ? 
        places : places.filter(place => place.category === category);
    
    // Update results container
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-info-circle"></i>
                <span>No ${category !== 'all' ? placeCategories.find(c => c.type === category).label : 'places'} found.</span>
            </div>
        `;
        return;
    }
    
    // Group by category
    const placesByCategory = {};
    filtered.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Display places by category
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const categoryInfo = placeCategories.find(c => c.type === categoryKey);
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'place-category';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-icon" style="background-color: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                <i class="fas ${categoryInfo.icon}"></i>
            </div>
            <h3>${categoryInfo.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'place-card';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4>${place.name}</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="place-details-row">
                    <div class="rating">
                        <i class="fas fa-star"></i>
                        <span>${place.rating.toFixed(1)}</span>
                        <span class="review-count">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Add marker to map
function addMarker(place) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.location,
        title: place.name,
        icon: {
            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
            fillColor: place.categoryColor,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1
        }
    });
    
    // Add click listener
    marker.addListener('click', function() {
        showPlaceDetails(place.id);
    });
    
    // Store marker
    markers.push(marker);
}

// Show place details
function showPlaceDetails(placeId) {
    const service = new google.maps.places.PlacesService(map);
    
    service.getDetails({
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 
                'rating', 'user_ratings_total', 'photos', 'url', 'opening_hours']
    }, function(place, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            let content = `<div class="place-details">`;
            
            // Add photo if available
            if (place.photos && place.photos.length > 0) {
                content += `
                    <div class="place-photos">
                        <img src="${place.photos[0].getUrl({maxWidth: 400, maxHeight: 300})}" alt="${place.name}">
                    </div>
                `;
            }
            
            // Basic info
            content += `
                <h3>${place.name}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${place.formatted_address || 'Address not available'}</p>
            `;
            
            // Phone if available
            if (place.formatted_phone_number) {
                content += `<p><i class="fas fa-phone"></i> ${place.formatted_phone_number}</p>`;
            }
            
            // Rating
            if (place.rating) {
                content += `
                    <div class="rating-container">
                        <div class="rating">
                            <i class="fas fa-star"></i>
                            <span>${place.rating.toFixed(1)}</span>
                            <span class="review-count">(${place.user_ratings_total} reviews)</span>
                        </div>
                    </div>
                `;
            }
            
            // Opening hours
            if (place.opening_hours && place.opening_hours.weekday_text) {
                content += `
                    <div class="opening-hours">
                        <h4>Opening Hours</h4>
                        <ul>
                `;
                
                place.opening_hours.weekday_text.forEach(day => {
                    content += `<li>${day}</li>`;
                });
                
                content += `
                        </ul>
                    </div>
                `;
            }
            
            // Actions
            content += `
                <div class="place-actions">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.name)}&destination_place_id=${place.place_id}" target="_blank" class="btn primary">
                        <i class="fas fa-directions"></i> Directions
                    </a>
            `;
            
            if (place.website) {
                content += `
                    <a href="${place.website}" target="_blank" class="btn">
                        <i class="fas fa-globe"></i> Website
                    </a>
                `;
            }
            
            content += `
                </div>
            </div>`;
            
            showModal(place.name, content);
        } else {
            showToast("Couldn't load place details");
        }
    });
}

// Toggle custom location mode
function toggleCustomLocationMode() {
    customLocationMode = !customLocationMode;
    
    const button = document.getElementById('custom-location-btn');
    if (customLocationMode) {
        button.classList.add('active');
        document.getElementById('map').style.cursor = 'crosshair';
        showToast("Click anywhere on the map to set a custom location");
    } else {
        button.classList.remove('active');
        document.getElementById('map').style.cursor = '';
    }
}

// Set custom location
function setCustomLocation(latLng) {
    userLocation = {
        lat: latLng.lat(),
        lng: latLng.lng()
    };
    
    // Update marker position
    userMarker.setPosition(userLocation);
    
    // Update circle position
    radiusCircle.setCenter(userLocation);
    
    // Exit custom location mode
    customLocationMode = false;
    document.getElementById('custom-location-btn').classList.remove('active');
    document.getElementById('map').style.cursor = '';
    
    // Find places at new location
    findNearbyPlaces();
    
    showToast("Custom location set");
}

// Search for a location
function searchLocation() {
    const input = document.getElementById('location-search').value;
    if (!input.trim()) return;
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: input }, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
            const location = results[0].geometry.location;
            
            // Center map on location
            map.setCenter(location);
            
            // Set as custom location
            setCustomLocation(location);
            
            // Update search box with formatted address
            document.getElementById('location-search').value = results[0].formatted_address;
        } else {
            showToast("Location not found. Try a more specific name.");
        }
    });
}

// Update search radius
function updateRadius() {
    const input = document.getElementById('radius-input');
    const radius = parseInt(input.value);
    
    if (isNaN(radius) || radius < 1 || radius > 50) {
        showToast("Please enter a radius between 1 and 50 km");
        return;
    }
    
    searchRadius = radius * 1000; // Convert to meters
    
    // Update radius circle
    if (radiusCircle) {
        radiusCircle.setRadius(searchRadius);
    }
    
    // Search with new radius
    findNearbyPlaces();
}

// Recenter map
function recenterMap() {
    if (map && userMarker) {
        map.setCenter(userMarker.getPosition());
        map.setZoom(14);
    }
}

// Sort places
function sortPlaces(sortBy) {
    if (!places.length) return;
    
    let filtered = [...places];
    
    // Apply current category filter
    const activeCategory = document.querySelector('.filter-chip.active').dataset.category;
    if (activeCategory !== 'all') {
        filtered = filtered.filter(place => place.category === activeCategory);
    }
    
    // Sort by selected criteria
    if (sortBy === 'distance') {
        filtered.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'rating') {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Clear and redisplay
    clearMarkers();
    
    // Group by category
    const placesByCategory = {};
    filtered.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Update display
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const categoryInfo = placeCategories.find(c => c.type === categoryKey);
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'place-category';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-icon" style="background-color: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                <i class="fas ${categoryInfo.icon}"></i>
            </div>
            <h3>${categoryInfo.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'place-card';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4>${place.name}</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="place-details-row">
                    <div class="rating">
                        <i class="fas fa-star"></i>
                        <span>${place.rating.toFixed(1)}</span>
                        <span class="review-count">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Helper functions
function clearResults() {
    places = [];
    clearMarkers();
    document.getElementById('results-list').innerHTML = 
        '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i><span>Finding nearby places...</span></div>';
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = 'toast show';
    
    setTimeout(function() {
        toast.className = toast.className.replace("show", "");
    }, 3000);
}

function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    // Set title and content
    modalBody.innerHTML = `<h3>${title}</h3>${content}`;
    
    // Show modal
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function showAbout() {
    const content = `
        <div class="about-content">
            <p>Nearby Essentials helps you find important places around your location.</p>
            <p>This app shows you the highest-rated places in each category.</p>
            <h4>Features:</h4>
            <ul>
                <li>Find essential places near your current location</li>
                <li>Search for any location by name</li>
                <li>Set a custom location by clicking on the map</li>
                <li>Filter places by category</li>
                <li>Sort places by distance, rating or name</li>
                <li>Filter out potentially fake listings</li>
                <li>Get directions to any place with one click</li>
            </ul>
            <p><strong>Note:</strong> This app works best with location services enabled.</p>
        </div>
    `;
    
    showModal('About Nearby Essentials', content);
}