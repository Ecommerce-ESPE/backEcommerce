const { moment } = require('../config/components/timeConfig');

module.exports = {
  formatDate: (date, format = 'YYYY-MM-DD') => {
    return moment(date).format(format);
  },
  
  getStartOfDay: () => {
    return moment().startOf('day').toDate();
  },
  
  getEndOfDay: () => {
    return moment().endOf('day').toDate();
  },
  
  isDateInRange: (date, start, end) => {
    const checkDate = moment(date);
    return checkDate.isSameOrAfter(start) && checkDate.isSameOrBefore(end);
  }
};