export const chartsConfig = {
  chartProvider: {
    title: 'Matching activity',
    theme: 'custom',
    primaryColors: ['#00548d', '#f6821f'],
    colors: [
      // '#00548d',
      // '#f6821f',
      // '#2ca02c',
      // '#d62728',
      // '#9467bd',
      // '#8c564b',
      // '#e377c2',
      // '#7f7f7f',
      // '#bcbd22',
      // '#17becf',
      // '#aec7e8',
      // '#ffbb78',
      // '#98df8a',
      // '#ff9896',
      // '#c5b0d5',
      // '#c49c94',
      // '#f7b6d2',
      // '#c7c7c7',
      // '#dbdb8d',
      // '#9edae5',
      // base
      '#003f6b',
      '#004a7c',
      '#00548d', // base
      '#1a6fa3',
      '#338ab8',
      '#66a9cc',
      '#99c8e0',
      '#cce6f2',
      '#e6f3fa',
      '#f2f9fd',

      // Orange scale (accent)
      '#cc6a19',
      '#e6761c',
      '#f6821f', // base
      '#f7953f',
      '#f9a95f',
      '#fbbd7f',
      '#fcd19f',
      '#fee5bf',
      '#fff2df',

      // Neutral / contrast helpers
      '#7f7f7f',
    ],
  },
};

export enum UserRole {
  Candidate = 'candidate',
  Provider = 'provider',
  Advisor = 'advisor',
}
