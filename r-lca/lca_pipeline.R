# Reusable LCA analysis pipeline in base R (no packages required).
# Inputs : inventory.csv (process, flow, amount, unit, gsd)
#          factors.csv   (flow, category, factor, unit)
# Outputs: out/impacts_by_process.csv, out/monte_carlo_summary.csv,
#          out/sensitivity.csv, out/scenarios.csv, out/*.png
# Run    : Rscript lca_pipeline.R
# The same functions drop into a tidyverse/data.table workflow unchanged:
# every function takes and returns plain data frames.

set.seed(42)
dir.create("out", showWarnings = FALSE)

read_inputs <- function(inv_path = "inventory.csv", cf_path = "factors.csv") {
  inv <- read.csv(inv_path, stringsAsFactors = FALSE)
  cf  <- read.csv(cf_path,  stringsAsFactors = FALSE)
  stopifnot(all(c("process", "flow", "amount", "gsd") %in% names(inv)),
            all(c("flow", "category", "factor") %in% names(cf)),
            all(inv$amount >= 0), all(inv$gsd >= 1))
  missing <- setdiff(unique(inv$flow), unique(cf$flow))
  if (length(missing)) stop("no characterisation factor for: ", paste(missing, collapse = ", "))
  dups <- duplicated(inv[c("process", "flow")])
  if (any(dups)) stop("duplicate process/flow rows: ", sum(dups))
  list(inv = inv, cf = cf)
}

# Impact per process and category for one vector of amounts.
characterise <- function(inv, cf, amount = inv$amount) {
  inv$amount <- amount
  m <- merge(inv, cf, by = "flow")
  m$impact <- m$amount * m$factor
  aggregate(impact ~ process + category, data = m, FUN = sum)
}

totals <- function(inv, cf, amount = inv$amount) {
  x <- characterise(inv, cf, amount)
  tapply(x$impact, x$category, sum)
}

# Monte Carlo with lognormal uncertainty: median = amount, sigma = log(gsd).
monte_carlo <- function(inv, cf, n = 10000) {
  draws <- t(replicate(n, totals(inv, cf,
                                 inv$amount * exp(rnorm(nrow(inv), 0, log(inv$gsd))))))
  data.frame(category = colnames(draws),
             deterministic = as.numeric(totals(inv, cf)[colnames(draws)]),
             mean = colMeans(draws),
             p05 = apply(draws, 2, quantile, 0.05),
             p50 = apply(draws, 2, quantile, 0.50),
             p95 = apply(draws, 2, quantile, 0.95),
             cv  = apply(draws, 2, sd) / colMeans(draws),
             row.names = NULL)
}

# One-at-a-time sensitivity: each inventory row +/-10%, change in total.
sensitivity <- function(inv, cf, delta = 0.10) {
  base <- totals(inv, cf)
  rows <- lapply(seq_len(nrow(inv)), function(i) {
    up <- inv$amount; up[i] <- up[i] * (1 + delta)
    t_up <- totals(inv, cf, up)
    data.frame(process = inv$process[i], flow = inv$flow[i],
               category = names(base),
               pct_change_total = as.numeric(100 * (t_up[names(base)] - base) / base))
  })
  out <- do.call(rbind, rows)
  out[order(out$category, -abs(out$pct_change_total)), ]
}

# Scenario: swap a flow for another (e.g. grid -> renewable electricity).
scenario_swap <- function(inv, from, to) {
  inv$flow[inv$flow == from] <- to
  inv
}

main <- function() {
  x <- read_inputs()
  inv <- x$inv; cf <- x$cf

  by_proc <- characterise(inv, cf)
  write.csv(by_proc, "out/impacts_by_process.csv", row.names = FALSE)

  mc <- monte_carlo(inv, cf)
  write.csv(mc, "out/monte_carlo_summary.csv", row.names = FALSE)

  sens <- sensitivity(inv, cf)
  write.csv(sens, "out/sensitivity.csv", row.names = FALSE)

  scen <- rbind(
    data.frame(scenario = "baseline", t(totals(inv, cf))),
    data.frame(scenario = "renewable_electricity",
               t(totals(scenario_swap(inv, "electricity_grid", "electricity_renewable"), cf))))
  write.csv(scen, "out/scenarios.csv", row.names = FALSE)

  # Contribution chart (GWP)
  g <- by_proc[by_proc$category == "GWP100", ]
  g <- g[order(g$impact), ]
  png("out/gwp_contribution.png", width = 900, height = 500)
  par(mar = c(5, 12, 3, 2))
  barplot(g$impact, names.arg = g$process, horiz = TRUE, las = 1, col = "#3b6fb6",
          xlab = "kg CO2-eq per functional unit", main = "GWP100 contribution by process")
  dev.off()

  # Tornado chart (GWP, top 6)
  s <- head(sens[sens$category == "GWP100", ], 6)
  s <- s[order(abs(s$pct_change_total)), ]
  png("out/gwp_sensitivity.png", width = 900, height = 500)
  par(mar = c(5, 20, 3, 2))
  barplot(s$pct_change_total, names.arg = paste(s$process, s$flow, sep = " / "),
          horiz = TRUE, las = 1, col = "#c46b2b",
          xlab = "% change in total GWP for a +10% change in the input",
          main = "Sensitivity (one at a time)")
  dev.off()

  print(mc, digits = 3)
  cat("\nTop GWP drivers (+10% input):\n")
  print(head(sens[sens$category == "GWP100", ], 4), row.names = FALSE, digits = 3)
  cat("\nScenarios:\n"); print(scen, row.names = FALSE, digits = 4)
}

if (sys.nframe() == 0) main()
