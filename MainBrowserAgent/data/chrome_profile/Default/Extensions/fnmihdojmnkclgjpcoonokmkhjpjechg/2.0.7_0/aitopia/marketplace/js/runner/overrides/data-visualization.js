import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const CHART_TYPES = [
  { value: '', label: 'Auto (Let AI decide)' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'area', label: 'Area Chart' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'treemap', label: 'Treemap' },
  { value: 'funnel', label: 'Funnel Chart' },
  { value: 'radar', label: 'Radar Chart' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const data = createTextAreaField({
    label: 'Data',
    id: 'data',
    required: true,
    placeholder: 'Paste your data as JSON or CSV...',
    rows: 8,
  });

  const chartType = createSelectField({
    label: 'Chart type',
    id: 'chartType',
    required: false,
    options: CHART_TYPES,
    defaultValue: '',
  });

  // Main fields
  container.appendChild(data.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(chartType.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { data, chartType };

  return {
    getValues: async () => {
      data.clearError();

      const d = data.getTrimmed();
      if (!d) {
        data.setError('Please enter your data');
        throw new FieldValidationError('data', 'Please enter your data');
      }

      // Try to parse as JSON, otherwise send as string
      let parsedData;
      try {
        parsedData = JSON.parse(d);
      } catch {
        parsedData = d;
      }

      const values = {
        data: parsedData,
      };

      const chart = chartType.getValue();
      if (chart) values.chartType = chart;

      return values;
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
