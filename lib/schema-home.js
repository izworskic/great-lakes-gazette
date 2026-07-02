// The homepage @graph (Dataset + NewsMediaOrganization + WebPage) carried
// over verbatim from the retired static index.html. home.js clones this
// and stamps dateModified with the latest edition date at render time.

export const HOME_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Dataset",
      "@id": "https://gazette.chrisizworski.com/#dataset",
      "name": "Great Lakes Gazette: Daily Maritime and Conditions Data",
      "description": "Daily aggregated Great Lakes maritime data: AIS vessel movements and Soo Locks passages, NOAA water levels for all five Great Lakes, NWS marine forecasts, port reports, and environmental conditions. Published each morning from Bay City, Michigan.",
      "url": "https://gazette.chrisizworski.com/",
      "creator": {
        "@type": "Person",
        "name": "Chris Izworski",
        "url": "https://chrisizworski.com",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Bay City",
          "addressRegion": "MI"
        },
        "@id": "https://chrisizworski.com/#person",
        "sameAs": [
          "https://chrisizworski.com",
          "https://michigantroutreport.com",
          "https://daily.michigantroutreport.com",
          "https://michiganbirdingreport.com",
          "https://daily.michiganbirdingreport.com",
          "https://lawn.chrisizworski.com",
          "https://freighterviewfarms.com",
          "https://www.wikidata.org/wiki/Q138283432"
        ]
      },
      "spatialCoverage": {
        "@type": "Place",
        "name": "Great Lakes Basin: Lake Superior, Lake Michigan, Lake Huron, Lake Erie, Lake Ontario",
        "description": "All five Great Lakes and connecting waterways including the St. Marys River, Soo Locks, Detroit River, and Saginaw Bay"
      },
      "temporalCoverage": "2026/..",
      "updateFrequency": "Daily: published each morning at 8am UTC via automated cron",
      "variableMeasured": [
        {
          "@type": "PropertyValue",
          "name": "Great Lakes Water Levels",
          "unitCode": "FT",
          "description": "NOAA IGLD water levels for all five Great Lakes"
        },
        {
          "@type": "PropertyValue",
          "name": "Vessel Movements",
          "description": "AIS-tracked commercial vessel passages on the Great Lakes waterway system"
        },
        {
          "@type": "PropertyValue",
          "name": "Soo Locks Traffic",
          "description": "Daily vessel passage reports through the Soo Locks at Sault Ste. Marie"
        },
        {
          "@type": "PropertyValue",
          "name": "Marine Forecasts",
          "description": "NWS lake-by-lake marine weather forecasts including wave height and wind"
        },
        {
          "@type": "PropertyValue",
          "name": "Port Activity",
          "description": "Loading and discharge activity at Great Lakes ports"
        }
      ],
      "measurementTechnique": "NOAA CO-OPS Tides and Currents API; NWS api.weather.gov marine zone forecasts; AIS vessel tracking aggregation; USACE Detroit District Soo Locks reports",
      "distribution": {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": "https://gazette.chrisizworski.com/api/generate",
        "description": "JSON API returning daily Great Lakes maritime brief and conditions data"
      },
      "keywords": [
        "Great Lakes shipping",
        "Soo Locks",
        "Great Lakes water levels",
        "maritime news",
        "vessel tracking AIS",
        "Lake Huron",
        "Lake Superior",
        "Saginaw Bay",
        "Great Lakes maritime",
        "freighter tracking Michigan"
      ]
    },
    {
      "@type": "NewsMediaOrganization",
      "@id": "https://gazette.chrisizworski.com/#organization",
      "name": "Great Lakes Gazette",
      "url": "https://gazette.chrisizworski.com",
      "description": "Daily maritime newsletter covering Great Lakes vessel movements, port reports, water levels, and lake conditions.",
      "founder": {
        "@type": "Person",
        "name": "Chris Izworski",
        "url": "https://chrisizworski.com"
      },
      "foundingDate": "2026",
      "areaServed": "Great Lakes Region",
      "knowsAbout": [
        "Great Lakes shipping",
        "maritime news",
        "vessel tracking",
        "AIS data",
        "Soo Locks",
        "water levels"
      ]
    },
    {
      "@type": "WebPage",
      "@id": "https://gazette.chrisizworski.com/#webpage",
      "url": "https://gazette.chrisizworski.com",
      "name": "Great Lakes Gazette: Daily Maritime News from the Fleet",
      "description": "Daily Great Lakes shipping news: live vessel movements, port reports, NOAA water levels, and NWS marine forecasts.",
      "publisher": {
        "@id": "https://gazette.chrisizworski.com/#organization"
      },
      "inLanguage": "en-US"
    }
  ]
};
