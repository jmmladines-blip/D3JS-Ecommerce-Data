import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { csv } from "d3-fetch";
import { Range } from "react-range";
import "./RevenuePage.css";

export default function RevenuePage() {
  const [data, setData] = useState<any[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [monthRange, setMonthRange] = useState<number[]>([0, 0]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);

  const [stackedTable, setStackedTable] = useState({
    months: [] as string[],
    products: [] as string[],
    rows: [] as any[]
  });

  const [activeProducts, setActiveProducts] = useState<Set<string>>(new Set());

  const barRef = useRef<SVGSVGElement | null>(null);
  const stackedRef = useRef<SVGSVGElement | null>(null);

  const VALID_STATUSES = ["Pending", "Shipped", "Delivered"];

  // Load CSV and build month list
  useEffect(() => {
    csv("/src/data/ecommerce.csv").then((rows: any[]) => {
      setData(rows || []);
      const months = [...new Set((rows || []).map((d) => d.Date_YYYY_MM))].sort();
      setAllMonths(months);
      setMonthRange([0, Math.max(0, months.length - 1)]);
    }).catch(() => {
      setData([]);
      setAllMonths([]);
      setMonthRange([0, 0]);
    });
  }, []);

  // derive readable start/end date strings from monthRange and allMonths
  const startDateLabel =
    allMonths && allMonths.length && monthRange[0] >= 0
      ? allMonths[monthRange[0]]
      : "—";

  const endDateLabel =
    allMonths && allMonths.length && monthRange[1] >= 0
      ? allMonths[monthRange[1]]
      : "—";

  // Recompute filtered data, KPI and redraw charts when dependencies change
  useEffect(() => {
    if (!data.length || !allMonths.length) {
      setTotalRevenue(0);
      setStackedTable({ months: [], products: [], rows: [] });
      d3.select(barRef.current).selectAll("*").remove();
      d3.select(stackedRef.current).selectAll("*").remove();
      return;
    }

    const filtered = data.filter((d) => {
      if (!VALID_STATUSES.includes(d.OrderStatus)) return false;
      const idx = allMonths.indexOf(d.Date_YYYY_MM);
      return idx >= monthRange[0] && idx <= monthRange[1];
    });

    const revenue = filtered.reduce(
      (sum, row) => sum + parseFloat(row.TotalPrice || 0),
      0
    );
    setTotalRevenue(revenue);

    const productRevenue = d3.rollups(
      filtered,
      (v) => d3.sum(v, (d: any) => parseFloat(d.TotalPrice || 0)),
      (d: any) => d.Product
    ).sort((a: any, b: any) => b[1] - a[1]);

    drawBars(productRevenue);

    const stackedSource = data.filter((d) => VALID_STATUSES.includes(d.OrderStatus));
    const stackedFiltered = stackedSource.filter((d) => {
      const idx = allMonths.indexOf(d.Date_YYYY_MM);
      return idx >= monthRange[0] && idx <= monthRange[1];
    });

    const stackedData = buildStackedData(stackedFiltered);
    setStackedTable(stackedData);
    drawStacked(stackedData);
  }, [data, allMonths, monthRange, activeProducts]);

  // Build stacked data structure
  const buildStackedData = (rows: any[]) => {
    const months = [...new Set(rows.map((d) => d.Date_YYYY_MM))].sort();
    const products = [...new Set(rows.map((d) => d.Product))];

    const result = months.map((m) => {
      const row: any = { month: m };
      products.forEach((p) => {
        const total = rows
          .filter((d) => d.Date_YYYY_MM === m && d.Product === p)
          .reduce((sum, d) => sum + parseFloat(d.TotalPrice || 0), 0);
        row[p] = total;
      });
      return row;
    });

    return { months, products, rows: result };
  };

  // Draw horizontal bars
  const drawBars = (productRevenue: any[]) => {
    const svg = d3.select(barRef.current);
    svg.selectAll("*").remove();

    if (!productRevenue || !productRevenue.length) return;

    const width = 900;
    const height = 40 * productRevenue.length + 60;
    const margin = { top: 20, right: 120, bottom: 20, left: 180 };

    svg.attr("height", height);

    const x = d3.scaleLinear()
      .domain([0, d3.max(productRevenue, (d) => d[1]) || 0])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
      .domain(productRevenue.map((d) => d[0]))
      .range([margin.top, height - margin.bottom])
      .padding(0.3);

    svg.selectAll("rect")
      .data(productRevenue)
      .enter()
      .append("rect")
      .attr("x", margin.left)
      .attr("y", (d) => y(d[0]) as number)
      .attr("width", (d) => (x(d[1]) || margin.left) - margin.left)
      .attr("height", y.bandwidth())
      .attr("class", "rev-bar");

    svg.append("g")
      .attr("transform", `translate(${margin.left - 10},0)`)
      .call(d3.axisLeft(y))
      .selectAll("text")
      .attr("class", "rev-axis-label");

    svg.selectAll("text.value")
      .data(productRevenue)
      .enter()
      .append("text")
      .attr("class", "rev-value-label")
      .attr("x", (d) => (x(d[1]) || margin.left) + 5)
      .attr("y", (d) => (y(d[0]) as number) + y.bandwidth() / 2 + 4)
      .text((d) =>
        "$" + d[1].toLocaleString(undefined, { minimumFractionDigits: 2 })
      );
  };

  // Draw stacked bar chart with clickable legend
  const drawStacked = ({ months, products, rows }: { months: string[]; products: string[]; rows: any[] }) => {
    const svg = d3.select(stackedRef.current);
    svg.selectAll("*").remove();

    if (!months.length || !products.length || !rows.length) return;

    const width = 900;
    const height = 450;
    const margin = { top: 40, right: 200, bottom: 60, left: 80 };

    svg.attr("height", height);

    const palette = [
      "#1B4F72",
      "#117864",
      "#2E86C1",
      "#D68910",
      "#AF601A",
      "#A93226",
      "#7D3C98"
    ];

    const color = d3.scaleOrdinal<string>().domain(products).range(palette);

    const visibleProducts =
      activeProducts.size === 0
        ? products
        : products.filter((p) => activeProducts.has(p));

    const x = d3.scaleBand()
      .domain(months)
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([
        0,
        d3.max(rows, (r) =>
          d3.sum(visibleProducts, (p) => r[p] || 0)
        ) || 0
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const stack = d3.stack().keys(visibleProducts);
    const stackedSeries = stack(rows);

    svg.selectAll("g.layer")
      .data(stackedSeries)
      .enter()
      .append("g")
      .attr("fill", (d: any) => color(d.key))
      .selectAll("rect")
      .data((d: any) => d)
      .enter()
      .append("rect")
      .attr("x", (d: any) => x(d.data.month) as number)
      .attr("y", (d: any) => y(d[1]))
      .attr("height", (d: any) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());

    svg.selectAll("g.layer")
      .data(stackedSeries)
      .selectAll("text")
      .data((d: any) => d)
      .enter()
      .append("text")
      .attr("class", "stack-label")
      .attr("x", (d: any) => (x(d.data.month) as number) + x.bandwidth() / 2)
      .attr("y", (d: any) => y(d[1]) + (y(d[0]) - y(d[1])) / 2)
      .text((d: any) => {
        const value = d[1] - d[0];
        return value > 0 ? "$" + value.toLocaleString() : "";
      });

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("class", "rev-axis-label")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    products.forEach((p, i) => {
      const isActive = activeProducts.size === 0 || activeProducts.has(p);

      const g = legend.append("g")
        .attr("transform", `translate(0, ${i * 30})`)
        .style("cursor", "pointer")
        .on("click", () => {
          const newSet = new Set(activeProducts);
          if (newSet.has(p)) newSet.delete(p);
          else newSet.add(p);
          setActiveProducts(newSet);
        });

      g.append("rect")
        .attr("width", 22)
        .attr("height", 22)
        .attr("rx", 4)
        .attr("fill", color(p))
        .attr("opacity", isActive ? 1 : 0.4)
        .attr("class", "legend-button-box");

      g.append("text")
        .attr("x", 30)
        .attr("y", 16)
        .attr("class", "legend-button")
        .style("opacity", isActive ? 1 : 0.4)
        .text(p);
    });
  };

  // Helper to render month markers; if too many months, show a subset to avoid overlap
  const renderMonthMarkers = () => {
    if (!allMonths.length) return null;
    const denom = Math.max(1, allMonths.length - 1);
    const maxLabels = 12;
    const step = allMonths.length > maxLabels ? Math.ceil(allMonths.length / maxLabels) : 1;

    return (
      <div className="rev-slider-markers">
        {allMonths.map((m, i) => {
          if (i % step !== 0 && i !== allMonths.length - 1) {
            return (
              <div
                key={`tick-${i}`}
                className="rev-slider-marker rev-slider-tick"
                style={{ left: `${(i / denom) * 100}%` }}
              />
            );
          }
          return (
            <div
              key={m}
              className="rev-slider-marker"
              style={{ left: `${(i / denom) * 100}%` }}
            >
              {m}
            </div>
          );
        })}
      </div>
    );
  };

  // Clear all filters: reset month range and active products
  const clearAllFilters = () => {
    setActiveProducts(new Set());
    setMonthRange([0, Math.max(0, allMonths.length - 1)]);
  };

  return (
    <div className="rev-page-wrapper">
      {/* Dashboard header */}
      <header className="rev-dashboard-header">
        <h1 className="rev-dashboard-title">E-Commerce Dashboard</h1>
        <p className="rev-dashboard-desc">
          Data Source: Kaggle.com; This is a sample dashboard using D3JS, React, Javascript, HTML, and CSS.
        </p>
      </header>

      {/* Selected date box */}
      <div className="rev-selected-dates">
        <div className="rev-date-item">
          <div className="rev-date-label">Start Date</div>
          <div className="rev-date-value">{startDateLabel}</div>
        </div>

        <div className="rev-date-sep" />

        <div className="rev-date-item">
          <div className="rev-date-label">End Date</div>
          <div className="rev-date-value">{endDateLabel}</div>
        </div>
      </div>

      <div className="rev-container">
        <h2 className="visually-hidden">Revenue Visuals</h2>

        {/* Month Range Slider */}
        <div className="rev-filter">
          <label className="rev-slider-label">
            Reporting Period: {allMonths[monthRange[0]] || "—"} → {allMonths[monthRange[1]] || "—"}
          </label>

          {allMonths.length > 0 ? (
            <>
              <Range
                step={1}
                min={0}
                max={Math.max(0, allMonths.length - 1)}
                values={monthRange}
                onChange={(values) => {
                  const v0 = Math.max(0, Math.min(Math.floor(values[0]), allMonths.length - 1));
                  const v1 = Math.max(0, Math.min(Math.floor(values[1]), allMonths.length - 1));
                  if (v0 <= v1) setMonthRange([v0, v1]);
                  else setMonthRange([v1, v0]);
                }}
                renderTrack={({ props, children }) => (
                  <div
                    {...props}
                    style={{
                      height: "6px",
                      width: "100%",
                      background: "#ddd",
                      borderRadius: "3px",
                      marginTop: "20px",
                      position: "relative"
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        height: "6px",
                        background: "#2E86C1",
                        borderRadius: "3px",
                        left: `${(monthRange[0] / Math.max(1, allMonths.length - 1)) * 100}%`,
                        width: `${((monthRange[1] - monthRange[0]) / Math.max(1, allMonths.length - 1)) * 100}%`
                      }}
                    />
                    {children}
                  </div>
                )}
                renderThumb={({ props }) => (
                  <div
                    {...props}
                    style={{
                      ...props.style,
                      height: "20px",
                      width: "20px",
                      backgroundColor: "#1B4F72",
                      borderRadius: "50%",
                      border: "2px solid white",
                      boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  />
                )}
              />

              {/* Month markers */}
              {renderMonthMarkers()}

              {/* Clear All Filters button */}
              <div style={{ marginTop: 12 }}>
                <button
                  className="rev-clear-btn"
                  onClick={clearAllFilters}
                >
                  Clear All Filters
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 20 }}>Loading months…</div>
          )}
        </div>

        {/* KPI Card */}
        <div className="rev-card">
          <div className="rev-card-label">Total Revenue</div>
          <div className="rev-card-value">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="rev-card-footer">
            This only includes status: Pending, Shipped, and Delivered
          </div>
        </div>

        <h3>Total Revenue per Product</h3>
        <svg ref={barRef} width={900}></svg>

        <h3>Revenue by Month (Stacked Bar Chart)</h3>
        <svg ref={stackedRef} width={900}></svg>

        <h3>Revenue Summary Table</h3>

        {stackedTable.rows.length > 0 ? (
          <table className="rev-summary-table">
            <thead>
              <tr>
                <th>Month</th>
                {stackedTable.products.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {stackedTable.rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  {stackedTable.products.map((p) => (
                    <td key={p}>
                      $
                      {(r[p] || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2
                      })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>No summary data for selected range.</div>
        )}
      </div>
    </div>
  );
}
