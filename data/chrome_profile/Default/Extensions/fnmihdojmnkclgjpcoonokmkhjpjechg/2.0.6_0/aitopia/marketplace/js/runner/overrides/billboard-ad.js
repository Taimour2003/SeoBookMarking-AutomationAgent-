import { createMediaField, createSelectField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const BILLBOARD_TYPES = [
  { value: 'Standard Billboard', label: 'Standard Billboard' },
  { value: 'Digital LED Screen', label: 'Digital LED Screen' },
  { value: 'Bus Stop Shelter', label: 'Bus Stop Shelter' },
  { value: 'Subway Station', label: 'Subway Station' },
  { value: 'Building Wrap', label: 'Building Wrap' },
  { value: 'Street Poster', label: 'Street Poster' },
  { value: 'Mall Display', label: 'Mall Display' },
  { value: 'Airport Terminal', label: 'Airport Terminal' },
  { value: 'Stadium', label: 'Stadium' },
  { value: 'Highway Billboard', label: 'Highway Billboard' },
];

const ENVIRONMENTS = [
  { value: 'Urban - Daytime', label: 'Urban - Daytime' },
  { value: 'Urban - Nighttime', label: 'Urban - Nighttime' },
  { value: 'Highway', label: 'Highway' },
  { value: 'Downtown', label: 'Downtown' },
  { value: 'Suburban', label: 'Suburban' },
  { value: 'Indoor Mall', label: 'Indoor Mall' },
  { value: 'Transit Station', label: 'Transit Station' },
];

const TIME_OF_DAY = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Midday', label: 'Midday' },
  { value: 'Evening', label: 'Evening' },
  { value: 'Night', label: 'Night' },
];

const WEATHER = [
  { value: 'Clear', label: 'Clear' },
  { value: 'Cloudy', label: 'Cloudy' },
  { value: 'Rainy', label: 'Rainy' },
  { value: 'Foggy', label: 'Foggy' },
];

const ANGLES = [
  { value: 'Front View', label: 'Front View' },
  { value: 'Angled Left', label: 'Angled Left' },
  { value: 'Angled Right', label: 'Angled Right' },
  { value: 'Wide Shot', label: 'Wide Shot' },
];

const DISTANCES = [
  { value: 'Close Up', label: 'Close Up' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Far Away', label: 'Far Away' },
];

const QUALITY = [
  { value: 'Standard', label: 'Standard' },
  { value: 'High', label: 'High' },
  { value: 'Ultra HD', label: 'Ultra HD' },
];

const RESOLUTIONS = [
  { value: '1920x1080 (Full HD)', label: 'Full HD (1920x1080)' },
  { value: '2560x1440 (2K)', label: '2K (2560x1440)' },
  { value: '3840x2160 (4K)', label: '4K (3840x2160)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const adImageUrl = createMediaField({
    label: 'Ad image',
    id: 'adImageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the ad to place on the billboard.',
  });

  const billboardType = createSelectField({
    label: 'Billboard type',
    id: 'billboardType',
    required: false,
    options: BILLBOARD_TYPES,
    defaultValue: 'Standard Billboard',
  });

  const environment = createSelectField({
    label: 'Environment',
    id: 'environment',
    required: false,
    options: ENVIRONMENTS,
    defaultValue: 'Urban - Daytime',
  });

  const timeOfDay = createSelectField({
    label: 'Time of day',
    id: 'timeOfDay',
    required: false,
    options: TIME_OF_DAY,
    defaultValue: 'Midday',
  });

  const weather = createSelectField({
    label: 'Weather',
    id: 'weather',
    required: false,
    options: WEATHER,
    defaultValue: 'Clear',
  });

  const angle = createSelectField({
    label: 'Angle',
    id: 'angle',
    required: false,
    options: ANGLES,
    defaultValue: 'Front View',
  });

  const distance = createSelectField({
    label: 'Distance',
    id: 'distance',
    required: false,
    options: DISTANCES,
    defaultValue: 'Medium',
  });

  const quality = createSelectField({
    label: 'Quality',
    id: 'quality',
    required: false,
    options: QUALITY,
    defaultValue: 'High',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1920x1080 (Full HD)',
  });

  const variations = createNumberField({
    label: 'Variations',
    id: 'variations',
    required: false,
    min: 1,
    max: 10,
    defaultValue: 1,
  });

  const illuminated = createCheckboxField({
    label: 'Illuminated',
    id: 'illuminated',
    defaultChecked: false,
  });

  const addPeople = createCheckboxField({
    label: 'Add people',
    id: 'addPeople',
    defaultChecked: false,
  });

  const addTraffic = createCheckboxField({
    label: 'Add traffic',
    id: 'addTraffic',
    defaultChecked: false,
  });

  // Main fields
  container.appendChild(adImageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(billboardType.wrap);
  row1.appendChild(environment.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(timeOfDay.wrap);
  row2.appendChild(weather.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(angle.wrap);
  row3.appendChild(distance.wrap);
  moreBody.appendChild(row3);

  const row4 = window.document.createElement('div');
  row4.className = 'grid grid-cols-2 gap-4';
  row4.appendChild(quality.wrap);
  row4.appendChild(resolution.wrap);
  moreBody.appendChild(row4);

  moreBody.appendChild(variations.wrap);
  moreBody.appendChild(illuminated.wrap);
  moreBody.appendChild(addPeople.wrap);
  moreBody.appendChild(addTraffic.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { adImageUrl, billboardType, environment, timeOfDay, weather, angle, distance, quality, resolution, variations, illuminated, addPeople, addTraffic };

  return {
    getValues: async () => {
      adImageUrl.clearError();

      let ad;
      try {
        ad = await adImageUrl.getValue();
      } catch (err) {
        adImageUrl.setError('Please upload an ad image');
        throw new FieldValidationError('adImageUrl', 'Please upload an ad image');
      }

      if (!ad) {
        adImageUrl.setError('Please upload an ad image');
        throw new FieldValidationError('adImageUrl', 'Please upload an ad image');
      }

      return {
        adImageUrl: ad,
        billboardType: billboardType.getValue(),
        environment: environment.getValue(),
        timeOfDay: timeOfDay.getValue(),
        weather: weather.getValue(),
        angle: angle.getValue(),
        distance: distance.getValue(),
        quality: quality.getValue(),
        resolution: resolution.getValue(),
        variations: variations.getNumber() ?? 1,
        illuminated: illuminated.getValue(),
        addPeople: addPeople.getValue(),
        addTraffic: addTraffic.getValue(),
      };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
