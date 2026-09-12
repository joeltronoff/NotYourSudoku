use lisudoku_solver::solver::Solver;
use lisudoku_solver::types::SudokuConstraints;
use std::collections::BTreeMap;
use std::env;
use std::fs;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: verify <constraints.json>");
        std::process::exit(1);
    }
    let json = fs::read_to_string(&args[1]).expect("could not read file");
    let constraints: SudokuConstraints =
        serde_json::from_str(&json).expect("could not parse constraints JSON");

    let mut brute_solver = Solver::new(constraints.clone());
    let brute = brute_solver.brute_solve(true);
    println!("solution_count: {}", brute.solution_count);
    if let Some(sol) = &brute.solution {
        println!("solution:\n{}", sol.to_string(Some("\n")));
    }

    let mut logic_solver = Solver::new(constraints);
    let logical = logic_solver.logical_solve();
    println!("solution_type: {:?}", logical.solution_type);
    println!("step_count: {}", logical.steps.len());

    let mut rule_counts: BTreeMap<String, u32> = BTreeMap::new();
    for step in &logical.steps {
        *rule_counts.entry(format!("{:?}", step.rule)).or_insert(0) += 1;
    }
    println!("techniques_used:");
    for (rule, count) in &rule_counts {
        println!("  {}: {}", rule, count);
    }

    if let Some(reason) = &logical.invalid_state_reason {
        println!("invalid_state_reason: {:?}", reason);
    }
}
