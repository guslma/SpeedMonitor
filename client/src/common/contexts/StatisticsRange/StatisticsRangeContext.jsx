import React, {createContext, useState} from "react";

const getDefaultRange = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {from, to};
};

export const StatisticsRangeContext = createContext({});

export const StatisticsRangeProvider = (props) => {
    const [dateRange, setDateRange] = useState(getDefaultRange);

    return (
        <StatisticsRangeContext.Provider value={[dateRange, setDateRange]}>
            {props.children}
        </StatisticsRangeContext.Provider>
    );
};
